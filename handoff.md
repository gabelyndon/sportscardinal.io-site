# Handoff — 2026-11-13 (end of session, afternoon)

Current state of SportsCardinal for whoever picks this up next (usually future me, or a fresh Claude Code session). Overwrite this file at the end of each working session. For what the project *is*, see README. For how to work in this repo, see CLAUDE.md.

## Where things stand

The project pivoted in November. No longer a commercial venture — the 1,000 MAU gate, the marketplace, and the revenue model are off the table. SportsCardinal is now a **portfolio piece and a place to practice building AI agents**. Main focus has moved to the AI docushorts films. The repo is going public as a showcase, and the site uses only my own card photos.

Active work is the **card scanner agent**, built in four stages. **Stage 2 is now proven on real images. Stage 1 is still waiting on eBay approval.** Paused until eBay clears.

## Card scanner — the design that matters

The agent must work on **cards it has never seen**. Photo in, nothing known, go find out. If it matched against `cards.json` — which already holds player, grade and price — it wouldn't be an agent, it would be a lookup wearing a costume.

**`cards.json` is the evaluation set, not the answer source.** 195 cards where the answer is already known, used to measure accuracy.

Stages:

1. **eBay Browse client** — built. `agents/card-scanner/src/ebay.ts` + `cli.ts`. Zero runtime deps, plain fetch. Stubbed tests (token flow, 401 retry, 429, network failure, and more) are in `test/ebay.test.ts` (2f1a53f); the originals had only lived in scratch space. **Never run live.**
2. **Vision extraction** — built and **verified on 20 real photos** (see findings below). `src/vision.ts` + `extract-cli.ts`. Structured output via a `record_card` tool call (`tool_choice: auto`, because this model rejects a forced choice; an error is raised if the tool isn't called); anti-inference system prompt. Grade is split into `gradeNumeric` (number, only if printed) and `gradeLabel` (printed text, e.g. "GEM MT 10"). Images over 5 MB are resized with `sharp` to 1800px long edge, JPEG q90, EXIF rotation applied — this broke zero-deps, deliberately. `npm test` exists now (`test/vision.test.ts`).
3. **Agent loop** — not started. Design direction below.
4. **Eval harness** — not started. Score in tiers (below).

## Stage 2 findings (Nov 13)

- **120 of the 195 cards are graded; 75 are raw.** So cert lookup is the *main* path in stage 3, not a fallback.
- **Cert numbers: 10 of 10 correct** across PSA, BGS and SGC, photos from 2023–2026. Readable from the 1800px resized image. SGC's cert is tiny print in the label corner — the likeliest place for errors on blurrier photos.
- **Grades matched `cards.json` 10 of 10** once PSA wording is stripped.
- **Anti-inference rule held on every card.** Back-of-slab photos return the cert with a null grade (correct — the grade label isn't in frame). The "PSA ?" entry in the catalogue is that same case: cert-only record.
- **Raw cards: player and brand are read reliably, but year and card number are mostly null** — they're printed on the back, and **most raw cards were only photographed from the front.** Names were confirmed printed on the card for the faces checked (Sanders, Jeter), so no recognition-from-face.
- A "Turn Back the Clock" card shows 1983 in its design; the model correctly left `year` null. Keep that behavior.
- **Not yet tested: glare or steep-angle labels.** Plan is to shoot 2–3 deliberate glare/angle slab photos rather than search the 945.

## Stage 3 design direction

- **Graded (cert visible):** PSA cert lookup → exact identification.
- **Raw (front only):** keyword search from what was read ("Craig Biggio Topps"), then **visually compare my photo against listing photos** and take year and card number from the best-matching **listing title**. Evidence comes from the search results, not model memory — this keeps it an agent, not recognition.
- **No good match:** fail out loud with partial ID ("Biggio, Topps, couldn't confirm year").

## Eval scoring (stage 4)

Report in tiers, not one number: **player correct / set correct / exact card correct (year + number)**, with failures listed and explained. Ground truth: `cards.json` for player/set/grade/grader. No cert ground truth exists — certs were checked against the photos by eye.

Photo ↔ card mapping: `card-staging/review.csv` maps each exact original filename to its `card_id` (the `cards.json` id is the lowercased source filename). `agents/card-scanner/eval/graded.csv` lists the 120 graded cards (path column dropped — it held local paths). A narrow `.gitignore` exception lets that CSV past the blanket `*.csv` rule. Decided to keep it public: the site already shows these cards and grades.

## Blocked / unverified

- **eBay developer account pending approval.** Applied Fri Nov 13; Monday at the earliest. Use **Production** keys, not Sandbox — the client talks to api.ebay.com.
- **`ANTHROPIC_API_KEY` is in place** at `agents/card-scanner/.env`, confirmed gitignored (`.gitignore:40`). Key expires around Dec 13 (30-day key).
- **Session-end push confirmed (Nov 13):** `showcase` and `origin/showcase` both at 269788e before this handoff commit. `git log --oneline -4` showed 269788e (display name), 2f1a53f (eBay tests), 46bcca6 (stages 1–2) and e8c42cc (showcase phase 1).
- **Deploy still unverified** after the earlier force-push to `main`. Check https://sportscardinal-io-site.gabelyndon.workers.dev came up.

## Git state

All branches on GitHub except `main-pre-polish`.

- **`main`** — deployed trunk at 2bafd5f.
- **`showcase`** — current working branch. Descends from `real-cards`. Holds 46bcca6 (stages 1–2, resize, graded.csv, .gitignore exception), 2f1a53f (eBay tests) and 269788e (`.io → .ai` display name; `src/lib/site.ts` — display name only; `site:` in astro.config, canonical tags, og:url and the Worker name untouched until DNS cutover).
- **`real-cards`** — 195 catalogued cards as the game deck.
- **`main-local`** — pre-force-push backup. Disposable.
- **`main-pre-polish`** — local only, bc27169. GH007 blocks it (old email). Keep or delete; nothing depends on it.

Commits use the GitHub noreply address. Older commits keep the old one — not rewriting history.

## Next session

1. If eBay approved: put Production keys in `.env`, run stage 1 live with one keyword search and one cert-number search.
2. Shoot 2–3 glare/angle slab photos and run extraction on them.
3. Start stage 3: cert path first (covers 120/195), then raw-card photo matching.

## Other decisions worth knowing

- **Marketplace dropped.** Promote my own eBay store listings instead.
- **Market analysis runs on asking prices, not sold prices.** Marketplace Insights API is closed to new developers; public sold search went behind a login in Aug 2026. Browse API returns live listings only.
- **Card grading will not predict a PSA grade.** Centering and condition flags only.
- **`.ai` is the primary domain**, `.io` 301-redirects. DNS cutover not executed yet.
- **App-style layout approved** (frozen bottom tab bar, five sections, neon gradient). **Still not ported into Astro.**

## Still open

- All 195 prices are AI estimates (`priceSource: "estimate"`); 55 carry a `notes` flag.
- Keep the iridescent cardinal or regenerate naturalistic? (logo, favicon, app icon)
- No contact route anywhere on the site.
