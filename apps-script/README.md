# Google Apps Script — dashboard snapshots

Aggregates the private Office-Register sheet and saves a daily JSON snapshot to this repo at:

`admin/data/{year}.json`

For **2024–2026**, Refresh also builds a case-search index at:

`admin/data/{year}-cases.json`

(Applicant A, Address I, Project J, Area office L, Report link AI smart chips.)

The admin UI normally reads that static JSON (fast). **Refresh data** rebuilds from the sheet and commits the file(s) to GitHub.

**Reminder:** 2021–2023 are not included in case search yet — confirm their column layout before enabling.

## Deploy / update

1. Open any year spreadsheet (e.g. 2025) → Extensions → Apps Script.
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
7. Case search reads Report Link **smart chips** via the Sheets API. On first Refresh after updating `Code.gs`, approve any new OAuth prompt. If chip URLs are missing, enable the **Google Sheets API** for the Apps Script project (Services / Google Cloud console) and redeploy.

## Admin env

```env
VITE_SHEETS_PROXY_URL=https://script.google.com/macros/s/.../exec
VITE_SHEETS_PROXY_KEY=<same as PROXY_KEY>
```

## Notes

- Spreadsheet stays private.
- Without `GITHUB_TOKEN`, Refresh still returns fresh data to the browser (and localStorage), but does not update the repo file.
- After a successful GitHub commit, production/GitHub Pages needs that commit (or a local pull) to serve the new static JSON.
