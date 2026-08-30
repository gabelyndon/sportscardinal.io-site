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

### 3. Set the secrets — in the Cloudflare dashboard, not in this repo

Open the **`sportscardinal-cms-auth`** Worker in the dashboard → **Settings → Variables and Secrets → Add**:

| Name | Type | Value |
|---|---|---|
| `GITHUB_CLIENT_ID` | Text | the Client ID from step 1 |
| `GITHUB_CLIENT_SECRET` | **Secret** (encrypted) | the Client secret from step 1 |
| `ALLOWED_DOMAINS` | Text | `sportscardinal-io-site.gabelyndon.workers.dev` |

Save — this redeploys the Worker with those values baked in as runtime bindings. Nothing above ever needs to be committed to git; `.dev.vars.example` documents the same names for local `wrangler dev` testing only (copy it to a gitignored `.dev.vars` file if you need that).

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
