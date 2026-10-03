# Narendra Ahirrao and Associates

Static marketing site for Government Registered Valuers and Chartered Engineers.

## Admin dashboard

A passcode-gated React admin app lives in [`admin-app/`](admin-app/).

```bash
cd admin-app
cp .env.example .env
npm install
npm run dev
```

Then open `http://localhost:5173/admin/`.

Private spreadsheet data is read through a Google Apps Script proxy — see [`apps-script/`](apps-script/).

Copyright 2020 Narendra Ahirrao and Associates.
