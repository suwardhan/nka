# Admin dashboard (source)

Cloudflare Access–gated dashboard for Narendra Ahirrao and Associates.

Authentication is **not** handled in this SPA. Cloudflare Access sits in front of `/admin` and `/admin-api`. Data and refresh go through the Worker at [`../cloudflare/admin-api`](../cloudflare/admin-api/).

## Local development

```bash
cd admin-app
cp .env.example .env
npm install
npm run dev
```

Also run the Worker locally (`cd ../cloudflare/admin-api && npm run dev`) with `ALLOW_DEV_BYPASS=1`.

Open http://localhost:5173/admin/

## Production deploy (GitHub Pages)

Builds into repo-root `/admin` (served at https://narendravaluers.in/admin/).

```bash
cd admin-app
# .env must set VITE_ADMIN_API_URL=https://narendravaluers.in/admin-api
npm run build:site
```

Then commit the generated `../admin` folder (and repo-root `404.html` if changed) and push to `master`.

`build:site` does **not** publish snapshot JSON under `admin/data` — only a README placeholder.

Deep links under `/admin/*` rely on the repo-root [`404.html`](../404.html) SPA fallback for GitHub Pages refreshes.

Visit persons / Report prepared by names are case-normalized in the app on load (Title Case, merged spellings on hover).

Env vars baked into the production bundle:

- `VITE_ADMIN_API_URL` — public Worker base (no secrets)
