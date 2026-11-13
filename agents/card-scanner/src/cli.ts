// Usage: npm run scan -- "1989 Upper Deck Ken Griffey Jr PSA 10" [--limit 50] [--urls]

import { parseArgs } from "node:util";
import {
  EbayClient,
  EbayAuthError,
  EbayRateLimitError,
  EbayNetworkError,
  EbayError,
  type Listing,
} from "./ebay.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: "string", default: "50" },
    urls: { type: "boolean", default: false },
    marketplace: { type: "string", default: "EBAY_US" },
  },
});

const query = positionals.join(" ").trim();

// Use process.exitCode rather than process.exit(): the latter can crash with a
// libuv assertion on Windows while handles are closing.
if (!query) {
  console.error('Usage: npm run scan -- "<search query>" [--limit N] [--urls] [--marketplace EBAY_US]');
  process.exitCode = 2;
} else {
  try {
    await run(query);
  } catch (err) {
    console.error(describeError(err));
    process.exitCode = 1;
  }
}

async function run(query: string): Promise<void> {
  const client = EbayClient.fromEnv();
  const { listings, total } = await client.searchListings(query, {
    limit: Number(values.limit),
    marketplaceId: values.marketplace,
  });

  if (listings.length === 0) {
    console.log(`No live listings found for: ${query}`);
    return;
  }
  printTable(listings);
  if (values.urls) {
    console.log();
    listings.forEach((l, i) => console.log(`${String(i + 1).padStart(2)}. ${l.itemWebUrl}`));
  }
  console.log();
  printSummary(listings, total);
  console.log("Note: these are ASKING prices from live listings, not sold prices.");
}

// ---------- output ----------

function printTable(listings: Listing[]): void {
  const rows = listings.map((l, i) => [
    String(i + 1),
    money(l.price, l.currency),
    l.condition ?? "-",
    l.buyingOptions.map(shortBuying).join("+") || "-",
    l.endsAt ? l.endsAt.slice(0, 16).replace("T", " ") : "-",
    truncate(l.title, 70),
  ]);
  const header = ["#", "Price", "Condition", "Type", "Ends (UTC)", "Title"];
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c]!.length)));
  const fmt = (r: string[]) => r.map((cell, c) => (c === 0 || c === 1 ? cell.padStart(widths[c]!) : cell.padEnd(widths[c]!))).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  rows.forEach((r) => console.log(fmt(r)));
}

function printSummary(listings: Listing[], total: number): void {
  const byCurrency = new Map<string, number[]>();
  for (const l of listings) {
    const arr = byCurrency.get(l.currency) ?? [];
    arr.push(l.price);
    byCurrency.set(l.currency, arr);
  }
  for (const [currency, prices] of byCurrency) {
    prices.sort((a, b) => a - b);
    console.log(
      `${currency}: count ${prices.length} | median ask ${money(median(prices), currency)} | ` +
        `min ${money(prices[0]!, currency)} | max ${money(prices[prices.length - 1]!, currency)}`,
    );
  }
  if (total > listings.length) {
    console.log(`(showing ${listings.length} of ${total} matches eBay reports)`);
  }
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

function shortBuying(o: string): string {
  return { FIXED_PRICE: "BIN", AUCTION: "Auction", BEST_OFFER: "Offer" }[o] ?? o;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function describeError(err: unknown): string {
  if (err instanceof EbayRateLimitError) return `Rate limited: ${err.message}`;
  if (err instanceof EbayAuthError) return `Auth error: ${err.message}`;
  if (err instanceof EbayNetworkError) return `Network error: ${err.message}`;
  if (err instanceof EbayError) return `eBay error: ${err.message}`;
  return err instanceof Error ? err.stack ?? err.message : String(err);
}
