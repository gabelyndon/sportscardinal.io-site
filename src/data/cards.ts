// Placeholder card data for the "Guess the Price" game.
// Swap `price` for real values (and `art` for real photos) once the
// GoDaddy product CSV is imported — see src/pages/game.astro.

export type CardCategory = "sports" | "vintage" | "veefriends";

export interface GameCard {
  id: string;
  category: CardCategory;
  title: string;
  subtitle: string;
  year: number;
  /** Actual market price in USD — this is what the player is guessing. */
  price: number;
  /** ISO date the price was captured — it's a snapshot, not a live quote. */
  priceAsOf: string;
  /** Placeholder "art": a gradient + icon, standing in for a real card photo. */
  art: {
    from: string;
    to: string;
    icon: string;
  };
}

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  sports: "Sports",
  vintage: "Vintage Character",
  veefriends: "VeeFriends",
};

export const CARDS: GameCard[] = [
  // --- Sports ---
  {
    id: "sports-01",
    category: "sports",
    title: "Rookie Phenom",
    subtitle: "Baseball · Series 1",
    year: 1989,
    price: 42,
    priceAsOf: "2026-07-14",
    art: { from: "#1e3a8a", to: "#3b82f6", icon: "⚾" },
  },
  {
    id: "sports-02",
    category: "sports",
    title: "Hardwood Legend",
    subtitle: "Basketball · Gold Refractor",
    year: 1997,
    price: 310,
    priceAsOf: "2026-06-02",
    art: { from: "#7c2d12", to: "#f97316", icon: "🏀" },
  },
  {
    id: "sports-03",
    category: "sports",
    title: "Gridiron Great",
    subtitle: "Football · Rookie Card",
    year: 2003,
    price: 85,
    priceAsOf: "2026-07-30",
    art: { from: "#14532d", to: "#22c55e", icon: "🏈" },
  },
  {
    id: "sports-04",
    category: "sports",
    title: "Ice Champion",
    subtitle: "Hockey · Autographed",
    year: 1994,
    price: 620,
    priceAsOf: "2026-05-18",
    art: { from: "#0c4a6e", to: "#38bdf8", icon: "🏒" },
  },
  {
    id: "sports-05",
    category: "sports",
    title: "Diamond Debut",
    subtitle: "Baseball · PSA 9",
    year: 1975,
    price: 1450,
    priceAsOf: "2026-08-01",
    art: { from: "#713f12", to: "#eab308", icon: "⚾" },
  },
  // --- Vintage character ---
  {
    id: "vintage-01",
    category: "vintage",
    title: "Wisecrack Kid",
    subtitle: "Sticker Series · #14",
    year: 1986,
    price: 18,
    priceAsOf: "2026-06-20",
    art: { from: "#581c87", to: "#a855f7", icon: "🃏" },
  },
  {
    id: "vintage-02",
    category: "vintage",
    title: "Saturday Morning Star",
    subtitle: "Cartoon Classics · #7",
    year: 1991,
    price: 65,
    priceAsOf: "2026-07-05",
    art: { from: "#831843", to: "#ec4899", icon: "📺" },
  },
  {
    id: "vintage-03",
    category: "vintage",
    title: "Monster Mash Villain",
    subtitle: "Creature Feature · Glow Ink",
    year: 1980,
    price: 240,
    priceAsOf: "2026-04-28",
    art: { from: "#052e16", to: "#4ade80", icon: "👹" },
  },
  {
    id: "vintage-04",
    category: "vintage",
    title: "Arcade Hero",
    subtitle: "Game Legends · Foil",
    year: 1988,
    price: 95,
    priceAsOf: "2026-08-10",
    art: { from: "#1e1b4b", to: "#818cf8", icon: "👾" },
  },
  {
    id: "vintage-05",
    category: "vintage",
    title: "Funny Pages Icon",
    subtitle: "Comic Strip Set · #1",
    year: 1972,
    price: 510,
    priceAsOf: "2026-03-15",
    art: { from: "#78350f", to: "#fbbf24", icon: "😂" },
  },
  // --- VeeFriends-style character cards ---
  {
    id: "veefriends-01",
    category: "veefriends",
    title: "Diligent Dolphin",
    subtitle: "Series 2 · Compete Collection",
    year: 2021,
    price: 55,
    priceAsOf: "2026-07-22",
    art: { from: "#164e63", to: "#22d3ee", icon: "🐬" },
  },
  {
    id: "veefriends-02",
    category: "veefriends",
    title: "Curious Capybara",
    subtitle: "Series 1 · Signed Edition",
    year: 2021,
    price: 890,
    priceAsOf: "2026-08-05",
    art: { from: "#3f3f46", to: "#a1a1aa", icon: "🦫" },
  },
  {
    id: "veefriends-03",
    category: "veefriends",
    title: "Empathetic Elephant",
    subtitle: "Series 2 · Rare Foil",
    year: 2022,
    price: 130,
    priceAsOf: "2026-06-11",
    art: { from: "#312e81", to: "#818cf8", icon: "🐘" },
  },
  {
    id: "veefriends-04",
    category: "veefriends",
    title: "Patient Panda",
    subtitle: "Series 2 · Base Set",
    year: 2022,
    price: 24,
    priceAsOf: "2026-08-20",
    art: { from: "#365314", to: "#84cc16", icon: "🐼" },
  },
  {
    id: "veefriends-05",
    category: "veefriends",
    title: "Gritty Gorilla",
    subtitle: "Series 1 · Gold Signature",
    year: 2021,
    price: 1975,
    priceAsOf: "2026-05-30",
    art: { from: "#450a0a", to: "#ef4444", icon: "🦍" },
  },
];
