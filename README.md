# Narendra Ahirrao and Associates

Static marketing site for Government Registered Valuers and Chartered Engineers.

## Admin dashboard

Passcode-free admin UI in [`admin-app/`](admin-app/), protected by **Cloudflare Access**. Data is served by a **Cloudflare Worker** ([`cloudflare/admin-api/`](cloudflare/admin-api/)) that talks to Google Apps Script ([`apps-script/`](apps-script/)). Snapshot JSON is **not** published under `/admin/data`.

```bash
cd admin-app
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/admin/` (point `VITE_ADMIN_API_URL` at local `wrangler dev` — see Worker README).

Production: https://narendravaluers.in/admin/ (after Access login).

Operator runbook: [`cloudflare/admin-api/README.md`](cloudflare/admin-api/README.md).

Copyright 2020 Narendra Ahirrao and Associates.
