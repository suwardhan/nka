# Admin dashboard

Passcode-gated dashboard for Narendra Ahirrao and Associates.

## Setup

```bash
cd admin
cp .env.example .env
# edit .env with passcode + Apps Script proxy URL/key
npm install
npm run dev
```

Open [http://localhost:5173/admin/](http://localhost:5173/admin/).

## Data loading

Normal loads read the static snapshot:

`public/data/{year}.json`

**Refresh data** rebuilds from the private Google Sheet via Apps Script and (with a GitHub token) commits that JSON back to the repo. See [`../apps-script/README.md`](../apps-script/README.md).

Env vars:

- `VITE_ADMIN_PASSCODE`
- `VITE_SHEETS_PROXY_URL` (only needed for Refresh)
- `VITE_SHEETS_PROXY_KEY`

## Production build

```bash
npm run build:site
```

This writes a static `/admin` bundle to `../admin-site/` (including `404.html` for SPA routing on GitHub Pages). Publish that folder as `/admin` next to the marketing site.
