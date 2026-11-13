# card-scanner

Stage 1 of the SportsCardinal card scanner agent: a small eBay Browse API client plus a CLI that proves we can pull real listing data. There is no AI in this stage.

> **Asking prices, not sold prices.** This returns what sellers are *currently asking* on live listings. The Browse API does not expose sold or completed sales, so the median shown is a median **ask**, which usually runs higher than what cards actually sell for. Don't treat it as market value.

## What it does

- Gets an OAuth2 application token (client-credentials) from eBay and caches it in memory, refreshing about 5 minutes before expiry.
- `searchListings(query, opts)` calls `/buy/browse/v1/item_summary/search` and returns typed results: title, price, currency, condition, buying options, item URL, and end time when present (auctions).
- On a 401 it refreshes the token once and retries once. A 429 is raised as `EbayRateLimitError` and is **not** retried. Network failures and timeouts (15s) raise `EbayNetworkError`.

## Get eBay credentials

1. Sign up at the [eBay Developer Program](https://developer.ebay.com/) (free).
2. Open [Application Keys](https://developer.ebay.com/my/keys) and create a keyset.
3. Copy the **Production** App ID (Client ID) and Cert ID (Client Secret). Sandbox keys won't work.

## Setup and run

Requires Node 22.18+ (it runs TypeScript directly, with no build step).

```sh
cd agents/card-scanner
npm install                  # only dev deps: typescript + @types/node
cp .env.example .env         # then fill in the two values
npm run scan -- "1989 Upper Deck Ken Griffey Jr PSA 10"
```

Options: `--limit N` (1-200, default 50), `--urls` (also list item links), `--marketplace EBAY_US`.

Output is a table of matches followed by per-currency summary lines: count, median ask, min, max. `npm run typecheck` runs `tsc`.

## Stage 2: vision extraction

`npm run extract -- <image-or-folder> [--limit N]` sends a card photo to the Anthropic API (plain HTTPS, no SDK) and prints structured JSON: `slabbed`, `grader` (PSA/BGS/SGC), `gradeNumeric` (e.g. `10`), `gradeLabel` (as printed, e.g. `"GEM MT 10"`), `certNumber`, `year`, `set`, `player`, `cardNumber`, `parallel`, `readable`, `notes`.

The prompt tells the model to report **only what is visible**: no inference and no filling gaps from hobby knowledge. Anything not clearly legible is `null`, and an unusable image comes back `readable: false` with the reason in `notes`. `gradeNumeric` is kept only if that number appears in the printed `gradeLabel`. A photo of the back of a slab returns a cert but a null grade.

Needs `ANTHROPIC_API_KEY` in `.env`. Images over 5 MB are downscaled to 1800px on the long edge (via `sharp`) before upload; smaller images are sent untouched. Each image is one API call and costs credits.

`npm test` runs unit tests for the output normalization.

### Eval data

`eval/graded.csv` lists the 120 graded cards from the site's `cards.json` with their original source filenames and hand-entered grades (id, source, date, grade, player, year, sizeMB). Use it to pick slabbed photos and to check extracted grader/grade. It has no cert numbers, so certs still need checking by eye.

## Secrets

`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` and `ANTHROPIC_API_KEY` come from `.env`, which is gitignored. Only `.env.example` (empty values) is committed. Never paste real keys into the example file.

## Notes

- Search text is matched loosely by eBay, so graded cards (e.g. "PSA 10") can include listings that merely mention the grade. Check titles before trusting a number.
- Keep call volume modest; the free tier has a daily call limit, and a 429 is surfaced rather than hidden.
