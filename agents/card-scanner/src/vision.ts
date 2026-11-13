// Vision extraction: card photo in, structured label data out.
// Plain HTTPS POST to the Anthropic Messages API (no SDK).
//
// The model is told to report ONLY what is visible. Anything it can't read is
// null. Nothing is inferred from hobby knowledge.

import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const REQUEST_TIMEOUT_MS = 90_000;
// The API rejects images over 5 MB (measured on the raw bytes we upload).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type Grader = "PSA" | "BGS" | "SGC";

export interface CardExtraction {
  slabbed: boolean;
  grader: Grader | null;
  /** The numeric grade printed on the label, e.g. 10 or 9.5. */
  gradeNumeric: number | null;
  /** The grade text exactly as printed, e.g. "GEM MT 10" or "9.5". */
  gradeLabel: string | null;
  certNumber: string | null;
  year: string | null;
  set: string | null;
  player: string | null;
  cardNumber: string | null;
  parallel: string | null;
  readable: boolean;
  notes: string | null;
}

export class VisionError extends Error {
  status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "VisionError";
    this.status = status;
  }
}

const SYSTEM_PROMPT = `You transcribe trading card photos into structured data. You MUST respond by calling the record_card tool exactly once, with no other text.

THE ONE RULE: report ONLY what is VISIBLE in the image.
- Do not infer. Do not fill gaps from your knowledge of the hobby, of players, sets, years, or typical label formats.
- If a field is not clearly legible in this image, it MUST be null. A null is always better than a guess.
- Do not "correct" what you read. If a label says what you believe is a mistake, transcribe it as printed.
- Never complete a partly hidden or blurry value (e.g. a cert number with an unreadable digit is null, not a best guess).
- Do not identify a card from the player's face or the card art alone. Only transcribe text actually printed on the card or its label.

Field guidance:
- slabbed: true only if the card is inside a third-party grading holder (slab) with a label. A raw card, top-loader or penny sleeve is false.
- grader: "PSA", "BGS" or "SGC" only if that company's name/logo is visible on the label; otherwise null.
- gradeLabel: the grade text exactly as printed on the label (e.g. "GEM MT 10", "NM 7", "9.5"); null if unreadable, not on this side of the slab, or not slabbed.
- gradeNumeric: the number printed as the grade, as a JSON number (e.g. 10, 9.5, 7). It must be a number that appears in the printed grade on the label, never a number you worked out; null whenever gradeLabel is null or no number is printed. Do not read the card's serial numbering (e.g. 06/10) or the card number as a grade.
- certNumber: the cert/serial number printed on the label, digits as shown; null if not fully legible.
- year, set, player, cardNumber, parallel: only from printed text on the slab label or the card itself. parallel is a printed variant/parallel name (e.g. "Refractor") only if the text says so; do not deduce it from colours or finish.
- readable: false if the image is too blurry, dark, cropped, glare-covered or otherwise unusable to read the card/label. If false, put the reason in notes and leave unreadable fields null.
- notes: brief factual remarks about legibility (e.g. "glare over cert number", "label partially cropped"). Never use notes to add information that is not visible.`;

const TOOL = {
  name: "record_card",
  description: "Record the card data that is visible in the image. Use null for anything not clearly legible.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "slabbed", "grader", "gradeNumeric", "gradeLabel", "certNumber", "year", "set",
      "player", "cardNumber", "parallel", "readable", "notes",
    ],
    properties: {
      slabbed: { type: "boolean" },
      grader: { type: ["string", "null"], enum: ["PSA", "BGS", "SGC", null] },
      gradeNumeric: { type: ["number", "null"] },
      gradeLabel: { type: ["string", "null"] },
      certNumber: { type: ["string", "null"] },
      year: { type: ["string", "null"] },
      set: { type: ["string", "null"] },
      player: { type: ["string", "null"] },
      cardNumber: { type: ["string", "null"] },
      parallel: { type: ["string", "null"] },
      readable: { type: "boolean" },
      notes: { type: ["string", "null"] },
    },
  },
} as const;

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const SUPPORTED_EXTENSIONS = Object.keys(MEDIA_TYPES);

export async function extractCard(
  imagePath: string,
  opts: { model?: string; apiKey?: string } = {},
): Promise<CardExtraction> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // status 401 so the CLI stops after the first image instead of repeating this 10+ times.
    throw new VisionError("Missing ANTHROPIC_API_KEY (set it in .env; see .env.example).", 401);
  }

  let mediaType = MEDIA_TYPES[extname(imagePath).toLowerCase()];
  if (!mediaType) {
    throw new VisionError(`Unsupported image type: ${imagePath} (use ${SUPPORTED_EXTENSIONS.join(", ")})`);
  }

  let bytes: Buffer = await readFile(imagePath);
  if (bytes.length > MAX_IMAGE_BYTES) {
    // Only oversize images are touched; everything else is sent as-is.
    bytes = await shrinkToFit(bytes, imagePath);
    mediaType = "image/jpeg";
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? process.env.CARD_SCANNER_MODEL ?? DEFAULT_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        // Forced tool_choice ("tool"/"any") is rejected by this model, so use auto
        // and rely on the prompt; a response without record_card is an error below.
        tool_choice: { type: "auto" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") } },
              { type: "text", text: "Transcribe this card using record_card. Report only what is visible; null for anything not clearly legible." },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new VisionError(
      err instanceof Error && err.name === "TimeoutError"
        ? `Anthropic request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
        : `Network error reaching Anthropic: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    if (res.status === 429) {
      throw new VisionError(`Anthropic rate limit (HTTP 429), retry-after ${res.headers.get("retry-after") ?? "?"}s. Not retrying.`, 429);
    }
    if (res.status === 401) throw new VisionError("Anthropic rejected ANTHROPIC_API_KEY (HTTP 401).", 401);
    throw new VisionError(`Anthropic API error (HTTP ${res.status}): ${body}`, res.status);
  }

  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const block = data.content?.find((b) => b.type === "tool_use" && b.name === TOOL.name);
  if (!block) {
    const text = data.content?.find((b) => b.type === "text") as { text?: string } | undefined;
    throw new VisionError(`Model did not call record_card. It said: ${(text?.text ?? "(nothing)").slice(0, 200)}`);
  }
  return normalize(block.input);
}

const RESIZE_LONG_EDGE = 1800;

// Downscale to ~1800px on the long edge (the API downsizes anything bigger
// anyway, so no useful detail is lost) and re-encode as JPEG.
async function shrinkToFit(input: Buffer, imagePath: string): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const out = await sharp(input)
    .rotate() // apply EXIF orientation before the metadata is dropped
    .resize({ width: RESIZE_LONG_EDGE, height: RESIZE_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  if (out.length > MAX_IMAGE_BYTES) {
    throw new VisionError(`Image still ${(out.length / 1048576).toFixed(1)} MB after resizing: ${imagePath}`);
  }
  console.error(
    `  (resized ${(input.length / 1048576).toFixed(1)} MB -> ${(out.length / 1048576).toFixed(1)} MB, ${RESIZE_LONG_EDGE}px long edge)`,
  );
  return out;
}

// gradeNumeric is only kept if it is a finite number that actually appears in
// the printed gradeLabel; otherwise it would be a value we can't point to on the
// label, so it becomes null. (We never derive a number the model didn't report.)
export function normalizeGrade(
  rawNumeric: unknown,
  gradeLabel: string | null,
): { gradeNumeric: number | null; gradeLabel: string | null } {
  const n = typeof rawNumeric === "number" ? rawNumeric : typeof rawNumeric === "string" ? Number(rawNumeric) : NaN;
  if (!gradeLabel || !Number.isFinite(n)) return { gradeNumeric: null, gradeLabel };
  const printed = (gradeLabel.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return { gradeNumeric: printed.includes(n) ? n : null, gradeLabel };
}

// Don't trust the model's JSON shape blindly: coerce to the declared type.
export function normalize(raw: unknown): CardExtraction {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const grader = str(o.grader)?.toUpperCase();
  return {
    slabbed: o.slabbed === true,
    grader: grader === "PSA" || grader === "BGS" || grader === "SGC" ? grader : null,
    ...normalizeGrade(o.gradeNumeric, str(o.gradeLabel)),
    certNumber: str(o.certNumber),
    year: str(o.year),
    set: str(o.set),
    player: str(o.player),
    cardNumber: str(o.cardNumber),
    parallel: str(o.parallel),
    readable: o.readable === true,
    notes: str(o.notes),
  };
}
