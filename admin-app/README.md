# Admin dashboard (source)

Passcode-gated dashboard for Narendra Ahirrao and Associates.

## Local development

```bash
cd admin-app
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173/admin/

## Production deploy (GitHub Pages)

Builds into repo-root `/admin` (served at https://narendravaluers.in/admin/).

```bash
cd admin-app
npm run build:site
```

Then commit the generated `../admin` folder (and repo-root `404.html` if changed) and push to `master`.

Deep links under `/admin/*` rely on the repo-root [`404.html`](../404.html) SPA fallback for GitHub Pages refreshes.

Env vars are baked into the production bundle at build time:

- `VITE_ADMIN_PASSCODE`
- `VITE_SHEETS_PROXY_URL`
- `VITE_SHEETS_PROXY_KEY`
