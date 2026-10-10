# Google Apps Script — dashboard snapshots

Aggregates the private Office-Register sheet. The **Cloudflare Worker** caches results in KV and serves them to the admin UI after Access login.

Public GitHub JSON under `admin/data/` is **off by default** (`COMMIT_TO_GITHUB` must be explicitly `true`).

For **2024–2026**, refresh also builds a case-search index (Applicant A, Address I, Project J, Area office L, Report link AI smart chips).

## Deploy / update

1. Open any year spreadsheet (e.g. 2025) → Extensions → Apps Script.
2. Replace the project script with [`Code.gs`](Code.gs).
3. Project Settings → Script properties — add:

| Property | Value |
|---|---|
| `PROXY_KEY` | long random secret; same as Worker `PROXY_KEY` |
| `COMMIT_TO_GITHUB` | leave unset/`false` (recommended) |
| `WORKER_INGEST_URL` | `https://nka-admin-api.<account>.workers.dev/internal/ingest` |
| `WORKER_INGEST_SECRET` | same as Worker `INGEST_SECRET` |
| `GITHUB_TOKEN` | only if `COMMIT_TO_GITHUB=true` |
| `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` / `GITHUB_FILE_PREFIX` | optional GitHub commit targets |

4. Deploy → Manage deployments → Edit → **New version** → Deploy (Execute as Me; Who has access: Anyone — the Worker holds the key).
5. In the editor, run `setupDailyTrigger` once (1am Asia/Kolkata daily).
6. File → Project settings → set project timezone to **Asia/Kolkata** if needed.
7. Case search reads Report Link **smart chips** via the Sheets API. On first Refresh after updating `Code.gs`, approve any new OAuth prompt. If chip URLs are missing, enable the **Google Sheets API** for the Apps Script project and redeploy.

## Web API

All requests require `?key=PROXY_KEY`:

- `action=aggregate` — live dashboard snapshot (includes cases when configured)
- `action=cases` — case-search index only
- `action=refresh` — rebuild; optional GitHub commit; POST to Worker ingest URL

## Notes

- Spreadsheet stays private.
- Rotate `PROXY_KEY` after moving off client-side secrets (old bundles leaked the previous key).
- Production admin loads data only via `/admin-api` (see [`../cloudflare/admin-api/README.md`](../cloudflare/admin-api/README.md)).
