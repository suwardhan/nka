# Google Apps Script — dashboard snapshots

Aggregates the private Office-Register sheet and saves a daily JSON snapshot to this repo at:

`admin/data/{year}.json`

The admin UI normally reads that static JSON (fast). **Refresh data** rebuilds from the sheet and commits the file to GitHub.

## Deploy / update

1. Open the 2025 spreadsheet → Extensions → Apps Script.
2. Replace `AdminProxy.gs` (or equivalent) with [`Code.gs`](Code.gs).
3. Project Settings → Script properties — add:

| Property | Value |
|---|---|
| `PROXY_KEY` | same as `VITE_SHEETS_PROXY_KEY` in `admin/.env` |
| `GITHUB_TOKEN` | GitHub PAT with `contents:write` on `suwardhan/nka` |
| `GITHUB_OWNER` | `suwardhan` (optional) |
| `GITHUB_REPO` | `nka` (optional) |
| `GITHUB_BRANCH` | `master` (optional) |
| `GITHUB_FILE_PREFIX` | `admin/data/` (optional) |

4. Deploy → Manage deployments → Edit → **New version** → Deploy.
5. In the editor, run `setupDailyTrigger` once (1am Asia/Kolkata daily).
6. File → Project settings → set project timezone to **Asia/Kolkata** if needed.

## Admin env

```env
VITE_SHEETS_PROXY_URL=https://script.google.com/macros/s/.../exec
VITE_SHEETS_PROXY_KEY=<same as PROXY_KEY>
```

## Notes

- Spreadsheet stays private.
- Without `GITHUB_TOKEN`, Refresh still returns fresh data to the browser (and localStorage), but does not update the repo file.
- After a successful GitHub commit, production/GitHub Pages needs that commit (or a local pull) to serve the new static JSON.
