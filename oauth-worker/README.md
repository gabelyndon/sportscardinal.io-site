# OAuth Worker (Decap CMS ↔ GitHub)

A vendored copy of [`sveltia/sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) (MIT — see `LICENSE.txt`), unmodified except for the name in `package.json`/`wrangler.jsonc`. It's a small Cloudflare Worker that lets `/admin` (Decap CMS) sign in with a GitHub account and commit directly to this repo, without depending on Netlify Identity/Git Gateway.

**Compatibility note:** this Worker implements the same OAuth handshake protocol Netlify CMS originated and both **Decap CMS** and **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)** (a from-scratch, faster/lighter Decap-compatible rewrite) speak. If we ever swap the admin UI from Decap to Sveltia, this Worker doesn't need to change — only `public/admin/config.yml` would.

## One-time setup

### 1. Register a GitHub OAuth App

Go to **github.com → Settings → Developer settings → OAuth Apps → New OAuth App** (direct link: https://github.com/settings/applications/new). Fill in:

| Field | Value |
|---|---|
| Application name | `SportsCardinal.io CMS` (or anything you'll recognize) |
| Homepage URL | `https://sportscardinal-io-site.gabelyndon.workers.dev` |
| Authorization callback URL | `https://sportscardinal-cms-auth.gabelyndon.workers.dev/callback` |

There's no scopes field on this form — GitHub OAuth Apps request scope at sign-in time, not at registration. This Worker asks for `repo,user` by default (full read/write on repos you grant access to, plus basic profile read to identify commits) — that's fixed in `src/index.js` and isn't configurable without editing the source.

Click **Register application**, then on the app's page click **Generate a new client secret**. Copy both the **Client ID** and the **Client secret** somewhere safe — the secret is shown only once.

The callback URL above assumes this Worker is deployed with the exact name `sportscardinal-cms-auth` (set in `wrangler.jsonc`) under the `gabelyndon` Cloudflare account — Workers subdomains are `<worker-name>.<account-subdomain>.workers.dev`, so that URL is correct as soon as it's deployed with that name, no need to wait and check afterward.

### 2. Deploy the Worker (Cloudflare dashboard → Import a repository)

Same flow as the main site, but pointed at this subfolder:

1. **Compute (Workers) → Create → Import a repository.**
2. Select the `sportscardinal.io-site` repo again (same repo, different Worker).
3. Build settings:
   - **Root directory**: `oauth-worker`
   - **Build command**: `npm install`
   - **Deploy command**: `npx wrangler deploy` (Cloudflare may infer this from `wrangler.jsonc` automatically)
4. Save and deploy. It should come up at `https://sportscardinal-cms-auth.gabelyndon.workers.dev`.

### 3. Set the client secret — in the Cloudflare dashboard, not in this repo

`GITHUB_CLIENT_ID` and `ALLOWED_DOMAINS` are non-sensitive and already committed in `wrangler.jsonc`'s `vars` block, so `wrangler deploy` sets them itself on every deploy. Only the client secret needs manual setup:

Open the **`sportscardinal-cms-auth`** Worker in the dashboard → **Settings → Variables and Secrets → Add**:

| Name | Type | Value |
|---|---|---|
| `GITHUB_CLIENT_SECRET` | **Secret** (encrypted) | the Client secret from step 1 |

Save — this redeploys the Worker with that value baked in as a runtime binding. `.dev.vars.example` documents the same name for local `wrangler dev` testing only (copy it to a gitignored `.dev.vars` file if you need that; `wrangler dev` picks up `GITHUB_CLIENT_ID`/`ALLOWED_DOMAINS` from `wrangler.jsonc` automatically, same as production).

> **Gotcha (bit us once, Aug 2026):** `wrangler deploy` — including the deploy Cloudflare's Git integration runs on every push — overwrites *all* dashboard-set plain-text vars with whatever `wrangler.jsonc`'s `vars` block contains, even if that block is empty or missing the key entirely. Encrypted secrets (`GITHUB_CLIENT_SECRET`) are a separate store and survive redeploys untouched. That's why a `GITHUB_CLIENT_ID`/`ALLOWED_DOMAINS` set only via the dashboard silently vanished on the next push, and `/admin` login started failing with no visible error (the worker's `/auth` step returns `MISCONFIGURED_CLIENT` — check `errorCode` in that endpoint's response body if this happens again). Fix: keep every non-sensitive var in `wrangler.jsonc` (as done above) so it's redeployed correctly every time; only what's genuinely sensitive belongs in the dashboard.

### 4. Point Decap CMS at it

In `public/admin/config.yml`, replace the placeholder `backend:` block with:

```yaml
backend:
  name: github
  repo: gabelyndon/sportscardinal.io-site
  branch: main
  base_url: https://sportscardinal-cms-auth.gabelyndon.workers.dev
```

and update `site_url` at the top of that file to the real site URL. Commit, push, redeploy the main site, then visit `/admin` and sign in with GitHub.
