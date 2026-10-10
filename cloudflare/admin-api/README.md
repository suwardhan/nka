# NKA admin API (Cloudflare Worker)

Authenticated API for dashboard snapshots and case search. Secrets never ship in the Vite bundle.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/admin-api/snapshot?year=` | Cloudflare Access JWT | Dashboard snapshot (KV, then Apps Script) |
| GET | `/admin-api/cases?year=` | Cloudflare Access JWT | Case-search index |
| POST | `/admin-api/refresh?year=` | Cloudflare Access JWT | Rebuild from Sheets + write KV |
| POST | `/admin-api/internal/ingest` | `Authorization: Bearer INGEST_SECRET` | Apps Script daily warm of KV |

## One-time Cloudflare setup

1. **DNS** — Add `narendravaluers.in` to Cloudflare; orange-cloud the apex (and `www` if used).
2. **Zero Trust → Access → Applications**
   - Protect `narendravaluers.in/admin*` (admin SPA).
   - Protect `narendravaluers.in/admin-api/snapshot*`, `/admin-api/cases*`, and `/admin-api/refresh*` (or a single app covering those paths).
   - **Do not** put Access in front of `/admin-api/internal/*` (Apps Script uses `INGEST_SECRET` instead). Prefer pointing `WORKER_INGEST_URL` at the `*.workers.dev` URL for ingest.
   - Policy: allow your admin email(s); One-time PIN or Google.
   - Copy the application **AUD** tag.
3. **KV** — `npx wrangler kv namespace create SNAPSHOTS` (and preview). Paste ids into [`wrangler.toml`](wrangler.toml).
4. **Secrets**
   ```bash
   npx wrangler secret put SHEETS_PROXY_URL
   npx wrangler secret put PROXY_KEY
   npx wrangler secret put CF_ACCESS_TEAM_DOMAIN   # e.g. yourteam.cloudflareaccess.com
   npx wrangler secret put CF_ACCESS_AUD
   npx wrangler secret put INGEST_SECRET
   ```
5. **Route** — Worker route `narendravaluers.in/admin-api/*` (dashboard or uncomment in `wrangler.toml`).
6. **Deploy** — `npm run deploy`

## Local development

```bash
cp .dev.vars.example .dev.vars
# fill secrets; set ALLOW_DEV_BYPASS=1
npm install
npm run dev
```

In `admin-app/.env`:

```env
VITE_ADMIN_API_URL=http://127.0.0.1:8787/admin-api
```

## Rotate keys

After first production deploy, **rotate `PROXY_KEY`** in Apps Script Script Properties and Worker secrets (old keys were baked into previous public JS bundles).
