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

Then commit the generated `../admin` folder and push to `master`.

Env vars are baked into the production bundle at build time:

- `VITE_ADMIN_PASSCODE`
- `VITE_SHEETS_PROXY_URL`
- `VITE_SHEETS_PROXY_KEY`
