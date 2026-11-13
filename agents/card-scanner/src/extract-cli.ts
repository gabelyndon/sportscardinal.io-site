// Usage:
//   npm run extract -- path/to/card.jpg
//   npm run extract -- path/to/folder --limit 10

import { parseArgs } from "node:util";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { extractCard, SUPPORTED_EXTENSIONS, VisionError, type CardExtraction } from "./vision.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: "string" },
    model: { type: "string" },
  },
});

const target = positionals[0];
if (!target) {
  console.error("Usage: npm run extract -- <image-or-folder> [--limit N] [--model <id>]");
  process.exitCode = 2;
} else {
  try {
    await main(target);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function main(target: string): Promise<void> {
  const files = await listImages(target, values.limit ? Number(values.limit) : undefined);
  if (files.length === 0) {
    console.log(`No images (${SUPPORTED_EXTENSIONS.join(", ")}) found in ${target}`);
    return;
  }

  let readable = 0;
  let unreadable = 0;
  let failed = 0;
  const failures: string[] = [];

  let consecutiveFailures = 0;
  for (const [i, file] of files.entries()) {
    console.log(`\n[${i + 1}/${files.length}] ${basename(file)}`);
    try {
      const result: CardExtraction = await extractCard(file, { model: values.model });
      console.log(JSON.stringify(result, null, 2));
      if (result.readable) readable++;
      else unreadable++;
      consecutiveFailures = 0;
    } catch (err) {
      failed++;
      consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${basename(file)}: ${msg}`);
      console.log(`ERROR: ${msg}`);
      // Auth / rate-limit errors will hit every remaining image too: stop.
      if (err instanceof VisionError && (err.status === 401 || err.status === 429)) {
        console.log("Stopping early: this error would repeat for every remaining image.");
        break;
      }
      if (consecutiveFailures >= 3) {
        console.log("Stopping early: 3 failures in a row looks like a systematic problem, not a bad image.");
        break;
      }
    }
  }

  console.log("\n--- summary ---");
  console.log(`images processed: ${readable + unreadable + failed} of ${files.length}`);
  console.log(`readable: ${readable} | marked unreadable: ${unreadable} | errors: ${failed}`);
  failures.forEach((f) => console.log(`  ! ${f}`));
  if (failed > 0) process.exitCode = 1;
}

async function listImages(target: string, limit?: number): Promise<string[]> {
  const info = await stat(target).catch(() => null);
  if (!info) throw new Error(`Not found: ${target}`);
  if (info.isFile()) return [target];

  const names = (await readdir(target))
    .filter((n) => SUPPORTED_EXTENSIONS.includes(extname(n).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sliced = limit && limit > 0 ? names.slice(0, limit) : names;
  return sliced.map((n) => join(target, n));
}
