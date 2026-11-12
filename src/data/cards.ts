// Card data for the "Guess the Price" game.
//
// cards.json is the single source of card data: one row per photographed card
// (700x933 WebP in public/cards/webp/, JPEG fallback in public/cards/jpg/).
// Rows with inPool: false have no image committed (duplicate shots, a card
// back, non-sports cards) and never reach the game. Prices are approximate
// demo values (priceSource: "demo estimate"), not market data.

import rows from "./cards.json";

export type Era = "vintage" | "modern" | "ultra-modern";
export type PriceTier = "common" | "mid" | "high" | "grail";
export type Sport = "Baseball" | "Basketball" | "Football" | "Hockey" | "Golf" | "Soccer";

/** One row of cards.json, as written by hand / the photo import. */
interface CardRow {
  id: string;
  image: string | null;
  imageFallback: string | null;
  player: string;
  year: number;
  set: string;
  variant: string;
  /** "PSA 10", "BGS 9.5", … or "" for a raw card. */
  grade: string;
  sport: string;
  price: number;
  priceAsOf: string;
  priceSource: string;
  inPool: boolean;
  /** Anything about the identification that still needs a human check. */
  notes?: string;
}

export interface GameCard {
  id: string;
  era: Era;
  sport: Sport;
  /** Player name. */
  title: string;
  /** Year, set, and any parallel/notes — e.g. "2023 Prizm Draft Picks #115 (RC) · Gold Ice". */
  subtitle: string;
  year: number;
  /** "Raw" or a grading company + grade, e.g. "PSA 10". */
  condition: string;
  /** Market price in USD — this is what the player is guessing. */
  price: number;
  priceTier: PriceTier;
  /** ISO date the price was captured — it's a snapshot, not a live quote. */
  priceAsOf: string;
  /** Photo of the actual card, served from public/. */
  image: string;
  /** JPEG fallback for browsers without WebP. */
  imageFallback: string;
}

export const ERA_LABELS: Record<Era, string> = {
  vintage: "Vintage",
  modern: "Modern",
  "ultra-modern": "Ultra-Modern",
};

const SPORTS = new Set<string>(["Baseball", "Basketball", "Football", "Hockey", "Golf", "Soccer"]);

function eraFor(year: number): Era {
  if (year < 1980) return "vintage";
  if (year < 2010) return "modern";
  return "ultra-modern";
}

/** Tier cutoffs are tuned to this inventory's price spread, not the hobby's
 * at large — round.ts draws a fixed mix per tier, so each tier needs enough
 * distinct players to fill it. */
export function priceTierFor(price: number): PriceTier {
  if (price >= 300) return "grail";
  if (price >= 80) return "high";
  if (price >= 25) return "mid";
  return "common";
}

export const CARDS: GameCard[] = (rows as CardRow[])
  .filter((row) => row.inPool && row.image && row.imageFallback && SPORTS.has(row.sport) && row.price > 0)
  .map((row) => ({
    id: row.id,
    era: eraFor(row.year),
    sport: row.sport as Sport,
    title: row.player,
    subtitle: [`${row.year} ${row.set}`, row.variant].filter(Boolean).join(" · "),
    year: row.year,
    condition: row.grade || "Raw",
    price: row.price,
    priceTier: priceTierFor(row.price),
    priceAsOf: row.priceAsOf,
    image: row.image as string,
    imageFallback: row.imageFallback as string,
  }));
