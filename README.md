# SportsCardinal.io

Astro site for SportsCardinal.io — a card blog, store, and a "Guess the Price" game, migrated off GoDaddy Website Builder.

## Structure

```text
/
├── public/admin/         Decap CMS (backend not wired up yet — see TODO in config.yml)
├── oauth-worker/         Cloudflare Worker for Decap CMS's GitHub sign-in (see its own README)
├── src/
│   ├── content/blog/     Blog posts (Markdown, edited via Decap CMS once wired up)
│   ├── content.config.ts Blog collection schema
│   ├── data/cards.ts     Starter deck: 60 real cards, estimated prices —
│   │                     see README's roadmap re: swapping in a real feed
│   ├── lib/
│   │   ├── round.ts      Draws each game round with a controlled price-tier
│   │   │                 mix (ROUND_TIER_MIX) instead of pure random
│   │   ├── scoring.ts    Guess-the-price scoring (log-space Gaussian)
│   │   └── site.ts       Business name/tagline — single source of truth
│   ├── layouts/          Shared page layout (blog pages)
│   └── pages/
│       ├── index.astro   Homepage
│       ├── game.astro    Guess the Price game
│       └── blog/         Blog listing + post pages
└── wrangler.jsonc        Cloudflare Workers static-assets config for the main site
```

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview the build locally before deploying |

## Deploying

Deployed via Cloudflare Workers (static assets), connected to this GitHub repo — pushes to `main` auto-deploy. See `wrangler.jsonc` for the assets config. The OAuth Worker that lets Decap CMS commit to this repo is a separate deploy — see [`oauth-worker/README.md`](./oauth-worker/README.md).

## Roadmap

- [x] Guess the Price game (60-card starter deck, real players/sets, estimated prices)
- [x] Blog (content collections + Decap CMS scaffold)
- [x] Wire up GitHub OAuth Worker so Decap CMS can publish
- [ ] Store (Stripe Checkout), catalog imported from GoDaddy CSV export
- [ ] Replace estimated prices with a real feed (SportsCardsPro CSV import) behind the game and store
- [ ] Point the `sportscardinal.io` domain (registered at GoDaddy) at Cloudflare
