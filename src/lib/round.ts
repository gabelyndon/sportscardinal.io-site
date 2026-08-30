// Round generation for "Guess the Price": each round draws a controlled mix
// of price tiers rather than pulling 10 cards uniformly at random, so a
// player doesn't get unlucky with (say) a run of five grails in a row or
// never see one at all.

import { CARDS, type GameCard, type PriceTier } from "../data/cards";

export const ROUND_SIZE = 10;

/** How many of each price tier make up one round. Tune freely — the total
 * doesn't need to add up to ROUND_SIZE, but the deck needs at least this
 * many distinct players in each tier or drawFromTier's dedup will start
 * forcing repeats. */
export const ROUND_TIER_MIX: Record<PriceTier, number> = {
  common: 5,
  mid: 3,
  high: 1,
  grail: 1,
};

// Smallest pools first: grail/high have the fewest cards to choose from, so
// drawing them before mid/common leaves the bigger pools maximum room to
// dodge whichever players the small tiers already used.
const TIER_DRAW_ORDER: PriceTier[] = ["grail", "high", "mid", "common"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const tierPools: Record<PriceTier, GameCard[]> = {
  common: CARDS.filter((c) => c.priceTier === "common"),
  mid: CARDS.filter((c) => c.priceTier === "mid"),
  high: CARDS.filter((c) => c.priceTier === "high"),
  grail: CARDS.filter((c) => c.priceTier === "grail"),
};

// One shuffled queue per tier, refilled (reshuffled from that tier's full
// pool) whenever it runs dry — every card in a tier is seen once before any
// repeat within that tier, same idea as the old single-deck shuffle just
// applied per tier instead of across the whole card list.
const tierQueues: Record<PriceTier, GameCard[]> = {
  common: [],
  mid: [],
  high: [],
  grail: [],
};

/**
 * Draws the next card from a tier's queue, skipping over (not discarding)
 * any candidate whose player is already in this round — several players
 * have cards in multiple tiers/price points, and both showing up in the
 * same round would look like a bug rather than a coincidence.
 */
function drawFromTier(tier: PriceTier, usedPlayers: Set<string>): GameCard {
  const pool = tierPools[tier];
  const queue = tierQueues[tier];
  const setAside: GameCard[] = [];
  let picked: GameCard | undefined;

  while (!picked) {
    if (queue.length === 0) queue.push(...shuffle(pool));
    const candidate = queue.shift()!;
    // Safety valve: if every card in this tier collides (usedPlayers already
    // covers every distinct player the tier has), stop skipping and just
    // accept the repeat rather than loop forever.
    if (!usedPlayers.has(candidate.title) || setAside.length >= pool.length) {
      picked = candidate;
    } else {
      setAside.push(candidate);
    }
  }

  // Skipped cards go back to the front, not the back — they were passed
  // over for this round only, not because they're stale.
  queue.unshift(...setAside);
  return picked;
}

function buildRound(): GameCard[] {
  const usedPlayers = new Set<string>();
  const round: GameCard[] = [];

  for (const tier of TIER_DRAW_ORDER) {
    for (let i = 0; i < ROUND_TIER_MIX[tier]; i++) {
      const card = drawFromTier(tier, usedPlayers);
      usedPlayers.add(card.title);
      round.push(card);
    }
  }

  return shuffle(round);
}

let roundBuffer: GameCard[] = [];
let lastCardId: string | null = null;

/** Draws the next card, generating a fresh tier-balanced round (per
 * ROUND_TIER_MIX above) whenever the current one runs out. */
export function drawCard(): GameCard {
  if (roundBuffer.length === 0) {
    roundBuffer = buildRound();
    // Avoid immediately repeating the last card seen across a round boundary.
    if (lastCardId && roundBuffer[0]?.id === lastCardId && roundBuffer.length > 1) {
      [roundBuffer[0], roundBuffer[1]] = [roundBuffer[1], roundBuffer[0]];
    }
  }
  const card = roundBuffer.shift()!;
  lastCardId = card.id;
  return card;
}
