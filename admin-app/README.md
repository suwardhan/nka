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

`build:site` preserves existing `../admin/data` so a deploy does not overwrite newer spreadsheet snapshots with older `public/data` copies.

Deep links under `/admin/*` rely on the repo-root [`404.html`](../404.html) SPA fallback for GitHub Pages refreshes.

Visit persons / Report prepared by names are case-normalized in the app on load (Title Case, merged spellings on hover).

Env vars are baked into the production bundle at build time:

- `VITE_ADMIN_PASSCODE`
- `VITE_SHEETS_PROXY_URL`
- `VITE_SHEETS_PROXY_KEY`
