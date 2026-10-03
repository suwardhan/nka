/**
 * NKA admin dashboard data proxy + daily GitHub JSON snapshot.
 *
 * Deploy as Web app:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Script Properties (Project Settings > Script properties):
 * - PROXY_KEY          (required) same as VITE_SHEETS_PROXY_KEY
 * - GITHUB_TOKEN       (required for refresh/daily commit)
 * - GITHUB_OWNER       default: suwardhan
 * - GITHUB_REPO        default: nka
 * - GITHUB_BRANCH      default: master
 * - GITHUB_FILE_PREFIX default: admin/data/
 *
 * Daily trigger (IST):
 * 1. Run function setupDailyTrigger once in the editor
 * 2. Or Triggers > Add trigger > dailyRefresh > Time-driven > Day timer > 1am-2am
 *    (Apps Script project timezone should be Asia/Kolkata)
 *
 * Web API:
 * - action=refresh (default for writes)  rebuild snapshot + commit to GitHub
 * - action=aggregate                     rebuild snapshot only (no GitHub write)
 */

/** Per-year spreadsheet + 0-based column indexes. */
var YEAR_CONFIG = {
  '2025': {
    spreadsheetId: '1lh2IS6CWxDi6f11tnT-1oRu6BL7mcGtBd4BK8H92zN0',
    areaOfficeColumn: 11, // L
    visitPersonColumn: 17, // R
  },
  '2024': {
    spreadsheetId: '1eEv8bD1qRsNrkWWpmaseH1nGsCQQMyDygEGnvNtufdo',
    areaOfficeColumn: 11, // L
    visitPersonColumn: 17, // R
  },
  '2023': {
    spreadsheetId: '14BJqq9GgMsysoROc8pfBB-8MpGWZXaeNkllTL_SzTQA',
    areaOfficeColumn: 10, // K
    visitPersonColumn: 13, // N
  },
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {}
    var props = PropertiesService.getScriptProperties()
    var proxyKey = props.getProperty('PROXY_KEY') || 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET'

    if (!params.key || params.key !== proxyKey) {
      return json_({ error: 'Unauthorized' })
    }

    var action = String(params.action || 'aggregate')
    var year = String(params.year || '2025')

    if (action === 'refresh') {
      return json_(refreshAndCommit_(year, params))
    }

    // Default: live aggregate (used by refresh internals / debugging)
    return json_(buildSnapshot_(year, params))
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) })
  }
}

/** Run once to create a daily 1am Asia/Kolkata trigger. */
function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyRefresh') {
      ScriptApp.deleteTrigger(triggers[i])
    }
  }
  ScriptApp.newTrigger('dailyRefresh')
    .timeBased()
    .atHour(1)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create()
}

/** Time-driven entry point. */
function dailyRefresh() {
  var years = Object.keys(YEAR_CONFIG)
  for (var i = 0; i < years.length; i++) {
    refreshAndCommit_(years[i], {})
  }
}

function refreshAndCommit_(year, params) {
  var snapshot = buildSnapshot_(year, params)
  if (snapshot.error) {
    return snapshot
  }

  var commit = commitSnapshotToGithub_(year, snapshot)
  snapshot.github = commit
  return snapshot
}

function buildSnapshot_(year, params) {
  var yearCfg = YEAR_CONFIG[String(year)] || {}
  var spreadsheetId =
    params.spreadsheetId || yearCfg.spreadsheetId || ''
  var sheetName = params.sheetName || 'Office-Register'

  var areaOfficeRaw =
    params.areaOfficeColumn != null && params.areaOfficeColumn !== ''
      ? params.areaOfficeColumn
      : yearCfg.areaOfficeColumn != null
        ? yearCfg.areaOfficeColumn
        : 11
  var visitPersonRaw =
    params.visitPersonColumn != null && params.visitPersonColumn !== ''
      ? params.visitPersonColumn
      : yearCfg.visitPersonColumn != null
        ? yearCfg.visitPersonColumn
        : 17
  var areaOfficeColumn = parseInt(areaOfficeRaw, 10)
  var visitPersonColumn = parseInt(visitPersonRaw, 10)

  if (!spreadsheetId) {
    return { error: 'Missing spreadsheetId for year ' + year }
  }
  if (isNaN(areaOfficeColumn) || areaOfficeColumn < 0) {
    return { error: 'Invalid areaOfficeColumn' }
  }
  if (isNaN(visitPersonColumn) || visitPersonColumn < 0) {
    return { error: 'Invalid visitPersonColumn' }
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  var sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet) {
    return { error: 'Sheet not found: ' + sheetName }
  }

  var values = sheet.getDataRange().getValues()
  var areaOffices = []
  var visitPersons = []
  if (values && values.length >= 2) {
    areaOffices = aggregateColumn_(values, areaOfficeColumn)
    visitPersons = aggregateColumn_(values, visitPersonColumn)
  }

  return {
    year: Number(year) || year,
    updatedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    areaOffices: areaOffices,
    visitPersons: visitPersons,
  }
}

function aggregateColumn_(values, columnIndex) {
  var counts = {}
  for (var i = 1; i < values.length; i++) {
    var row = values[i]
    if (!row || row.length <= columnIndex) {
      continue
    }
    var label = String(row[columnIndex] || '').trim()
    if (!label) {
      continue
    }
    counts[label] = (counts[label] || 0) + 1
  }

  return Object.keys(counts)
    .sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b)
    })
    .map(function (label) {
      return { name: label, count: counts[label] }
    })
}

function commitSnapshotToGithub_(year, snapshot) {
  var props = PropertiesService.getScriptProperties()
  var token = props.getProperty('GITHUB_TOKEN')
  if (!token) {
    return {
      ok: false,
      error:
        'Missing GITHUB_TOKEN script property. Snapshot returned to client but not saved to the repo.',
    }
  }

  var owner = props.getProperty('GITHUB_OWNER') || 'suwardhan'
  var repo = props.getProperty('GITHUB_REPO') || 'nka'
  var branch = props.getProperty('GITHUB_BRANCH') || 'master'
  var prefix = props.getProperty('GITHUB_FILE_PREFIX') || 'admin/data/'
  if (prefix.slice(-1) !== '/') {
    prefix += '/'
  }
  var path = prefix + String(year) + '.json'
  var apiBase =
    'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path

  var existingSha = null
  var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + encodeURIComponent(branch), {
    method: 'get',
    headers: githubHeaders_(token),
    muteHttpExceptions: true,
  })
  if (getRes.getResponseCode() === 200) {
    existingSha = JSON.parse(getRes.getContentText()).sha
  } else if (getRes.getResponseCode() !== 404) {
    return {
      ok: false,
      error: 'GitHub read failed (' + getRes.getResponseCode() + '): ' + getRes.getContentText(),
    }
  }

  var body = {
    message: 'chore(admin): refresh ' + year + ' dashboard snapshot',
    content: Utilities.base64Encode(
      JSON.stringify(snapshot, null, 2) + '\n',
      Utilities.Charset.UTF_8,
    ),
    branch: branch,
  }
  if (existingSha) {
    body.sha = existingSha
  }

  var putRes = UrlFetchApp.fetch(apiBase, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    headers: githubHeaders_(token),
    muteHttpExceptions: true,
  })

  if (putRes.getResponseCode() >= 200 && putRes.getResponseCode() < 300) {
    var parsed = JSON.parse(putRes.getContentText())
    return {
      ok: true,
      path: path,
      branch: branch,
      commitSha: parsed.commit && parsed.commit.sha,
    }
  }

  return {
    ok: false,
    error: 'GitHub write failed (' + putRes.getResponseCode() + '): ' + putRes.getContentText(),
  }
}

function githubHeaders_(token) {
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
