/**
 * NKA admin dashboard data proxy.
 *
 * Deploy as Web app:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Script Properties (Project Settings > Script properties):
 * - PROXY_KEY             (required) shared with Cloudflare Worker
 * - COMMIT_TO_GITHUB      "true" to also write JSON to GitHub (default: off)
 * - GITHUB_TOKEN          only if COMMIT_TO_GITHUB=true
 * - GITHUB_OWNER          default: suwardhan
 * - GITHUB_REPO           default: nka
 * - GITHUB_BRANCH         default: master
 * - GITHUB_FILE_PREFIX    default: admin/data/
 * - WORKER_INGEST_URL     e.g. https://nka-admin-api.<account>.workers.dev/internal/ingest
 *                         or https://narendravaluers.in/admin-api/internal/ingest
 * - WORKER_INGEST_SECRET  same as Worker INGEST_SECRET
 *
 * Daily trigger (IST):
 * 1. Run function setupDailyTrigger once in the editor
 * 2. Or Triggers > Add trigger > dailyRefresh > Time-driven > Day timer > 1am-2am
 *    (Apps Script project timezone should be Asia/Kolkata)
 *
 * Web API (all require ?key=PROXY_KEY):
 * - action=refresh     rebuild snapshot + cases; optionally commit; push to Worker KV
 * - action=aggregate   rebuild dashboard snapshot (includes cases when configured)
 * - action=cases       rebuild case-search index only
 *
 * Case search index (2024–2026):
 * - Columns: A applicant, I address, J project, L area office, AI report link chips
 */

/** Per-year spreadsheet + 0-based column indexes. */
var YEAR_CONFIG = {
  '2026': {
    spreadsheetId: '1QPntYKdKXIZM2UcTn_KrBOnsJ_vEEia-BSGs6DMMQr0',
    areaOfficeColumn: 11, // L
    visitPersonColumn: 17, // R
    reportPreparedByColumn: 32, // AG
    applicantColumn: 0, // A
    addressColumn: 8, // I
    projectColumn: 9, // J
    reportLinkColumn: 34, // AI
    includeCases: true,
  },
  '2025': {
    spreadsheetId: '1lh2IS6CWxDi6f11tnT-1oRu6BL7mcGtBd4BK8H92zN0',
    areaOfficeColumn: 11, // L
    visitPersonColumn: 17, // R
    reportPreparedByColumn: 32, // AG
    applicantColumn: 0, // A
    addressColumn: 8, // I
    projectColumn: 9, // J
    reportLinkColumn: 34, // AI
    includeCases: true,
  },
  '2024': {
    spreadsheetId: '1eEv8bD1qRsNrkWWpmaseH1nGsCQQMyDygEGnvNtufdo',
    areaOfficeColumn: 11, // L
    visitPersonColumn: 17, // R
    reportPreparedByColumn: 32, // AG
    applicantColumn: 0, // A
    addressColumn: 8, // I
    projectColumn: 9, // J
    reportLinkColumn: 34, // AI
    includeCases: true,
  },
  '2023': {
    spreadsheetId: '14BJqq9GgMsysoROc8pfBB-8MpGWZXaeNkllTL_SzTQA',
    areaOfficeColumn: 10, // K
    visitPersonColumn: 13, // N
    reportPreparedByColumn: 28, // AC
    includeCases: false,
  },
  '2022': {
    spreadsheetId: '16qZ3zcG2pvmesNqGuHn3xs4qK8gT_uamqdzvnkOYWNw',
    areaOfficeColumn: 10, // K
    visitPersonColumn: 13, // N
    reportPreparedByColumn: 28, // AC
    includeCases: false,
  },
  '2021': {
    spreadsheetId: '1GD4z3kUB7_c-QsCj3Vzlm-74f9zgjhWeqKNyAtSCXdo',
    areaOfficeColumn: 10, // K
    visitPersonColumn: 13, // N
    reportPreparedByColumn: 28, // AC
    includeCases: false,
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
    var year = String(params.year || '2026')

    if (action === 'refresh') {
      return json_(refreshAndCommit_(year, params))
    }

    if (action === 'cases') {
      return json_(buildCasesSnapshot_(year, params))
    }

    // Default: live aggregate (used by Worker cache-miss / debugging)
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

function commitToGithubEnabled_() {
  var props = PropertiesService.getScriptProperties()
  var flag = String(props.getProperty('COMMIT_TO_GITHUB') || '').toLowerCase()
  return flag === 'true' || flag === '1' || flag === 'yes'
}

function refreshAndCommit_(year, params) {
  var snapshot = buildSnapshot_(year, params)
  if (snapshot.error) {
    return snapshot
  }

  var cases = snapshot.cases || null
  var dashboard = {}
  var keys = Object.keys(snapshot)
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'cases') {
      continue
    }
    dashboard[keys[i]] = snapshot[keys[i]]
  }

  if (commitToGithubEnabled_()) {
    var commit = commitJsonToGithub_(
      String(year) + '.json',
      dashboard,
      'chore(admin): refresh ' + year + ' dashboard snapshot',
    )
    snapshot.github = commit

    if (cases) {
      var casesPayload = {
        year: Number(year) || year,
        updatedAt: snapshot.updatedAt,
        timezone: snapshot.timezone || 'Asia/Kolkata',
        cases: cases,
      }
      snapshot.casesGithub = commitJsonToGithub_(
        String(year) + '-cases.json',
        casesPayload,
        'chore(admin): refresh ' + year + ' cases search index',
      )
    }
  } else {
    snapshot.github = { ok: false, error: 'COMMIT_TO_GITHUB disabled' }
    if (cases) {
      snapshot.casesGithub = { ok: false, error: 'COMMIT_TO_GITHUB disabled' }
    }
  }

  var casesForIngest = cases
    ? {
        year: Number(year) || year,
        updatedAt: snapshot.updatedAt,
        timezone: snapshot.timezone || 'Asia/Kolkata',
        cases: cases,
      }
    : null
  snapshot.ingest = pushToWorkerIngest_(year, dashboard, casesForIngest)

  return snapshot
}

function buildCasesSnapshot_(year, params) {
  var yearCfg = YEAR_CONFIG[String(year)] || {}
  if (!yearCfg.includeCases) {
    return { error: 'Case search is not configured for year ' + year }
  }

  var snapshot = buildSnapshot_(year, params)
  if (snapshot.error) {
    return snapshot
  }
  if (!snapshot.cases) {
    return { error: 'No cases built for year ' + year }
  }

  return {
    year: snapshot.year,
    updatedAt: snapshot.updatedAt,
    timezone: snapshot.timezone || 'Asia/Kolkata',
    cases: snapshot.cases,
  }
}

function pushToWorkerIngest_(year, dashboard, casesPayload) {
  var props = PropertiesService.getScriptProperties()
  var ingestUrl = props.getProperty('WORKER_INGEST_URL')
  var ingestSecret = props.getProperty('WORKER_INGEST_SECRET')

  if (!ingestUrl || !ingestSecret) {
    return {
      ok: false,
      error: 'WORKER_INGEST_URL / WORKER_INGEST_SECRET not set',
    }
  }

  var body = {
    year: Number(year) || year,
    dashboard: dashboard,
  }
  if (casesPayload) {
    body.cases = casesPayload
  }

  var res = UrlFetchApp.fetch(ingestUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + ingestSecret,
    },
    muteHttpExceptions: true,
  })

  var code = res.getResponseCode()
  var text = res.getContentText()
  if (code >= 200 && code < 300) {
    return { ok: true, status: code }
  }

  return {
    ok: false,
    error: 'Worker ingest failed (' + code + '): ' + text,
  }
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
  var reportPreparedByRaw =
    params.reportPreparedByColumn != null && params.reportPreparedByColumn !== ''
      ? params.reportPreparedByColumn
      : yearCfg.reportPreparedByColumn != null
        ? yearCfg.reportPreparedByColumn
        : 32
  var areaOfficeColumn = parseInt(areaOfficeRaw, 10)
  var visitPersonColumn = parseInt(visitPersonRaw, 10)
  var reportPreparedByColumn = parseInt(reportPreparedByRaw, 10)

  if (!spreadsheetId) {
    return { error: 'Missing spreadsheetId for year ' + year }
  }
  if (isNaN(areaOfficeColumn) || areaOfficeColumn < 0) {
    return { error: 'Invalid areaOfficeColumn' }
  }
  if (isNaN(visitPersonColumn) || visitPersonColumn < 0) {
    return { error: 'Invalid visitPersonColumn' }
  }
  if (isNaN(reportPreparedByColumn) || reportPreparedByColumn < 0) {
    return { error: 'Invalid reportPreparedByColumn' }
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  var sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet) {
    return { error: 'Sheet not found: ' + sheetName }
  }

  var values = sheet.getDataRange().getValues()
  var areaOffices = []
  var visitPersons = []
  var reportPreparedBy = []
  if (values && values.length >= 2) {
    areaOffices = aggregateColumn_(values, areaOfficeColumn)
    visitPersons = aggregateColumn_(values, visitPersonColumn)
    reportPreparedBy = aggregateColumn_(values, reportPreparedByColumn)
  }

  var result = {
    year: Number(year) || year,
    updatedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    areaOffices: areaOffices,
    visitPersons: visitPersons,
    reportPreparedBy: reportPreparedBy,
  }

  var includeCases =
    params.includeCases === '0' || params.includeCases === 'false'
      ? false
      : yearCfg.includeCases === true

  if (includeCases && values && values.length >= 2) {
    result.cases = buildCases_(
      spreadsheetId,
      sheet,
      sheetName,
      values,
      yearCfg,
      Number(year) || year,
    )
  }

  return result
}

function buildCases_(spreadsheetId, sheet, sheetName, values, yearCfg, year) {
  var applicantColumn = yearCfg.applicantColumn
  var addressColumn = yearCfg.addressColumn
  var projectColumn = yearCfg.projectColumn
  var areaOfficeColumn = yearCfg.areaOfficeColumn
  var reportLinkColumn = yearCfg.reportLinkColumn

  var reportLinkLetter = columnIndexToLetter_(reportLinkColumn)
  var linkCells = fetchReportLinkCells_(
    spreadsheetId,
    sheetName,
    reportLinkLetter,
  )

  var displayLinks = []
  if (values.length > 0) {
    displayLinks = sheet
      .getRange(1, reportLinkColumn + 1, values.length, reportLinkColumn + 1)
      .getDisplayValues()
  }

  var cases = []
  for (var i = 1; i < values.length; i++) {
    var row = values[i]
    if (!row) {
      continue
    }

    var applicantName = cellText_(row, applicantColumn)
    var address = cellText_(row, addressColumn)
    var projectName = cellText_(row, projectColumn)
    var areaOffice = cellText_(row, areaOfficeColumn)

    if (!applicantName && !address && !projectName) {
      continue
    }

    var displayText =
      displayLinks[i] && displayLinks[i][0] != null
        ? String(displayLinks[i][0])
        : ''
    var reportLinks = parseReportLinks_(displayText, linkCells[i] || null)

    cases.push({
      year: year,
      row: i + 1,
      applicantName: applicantName,
      address: address,
      projectName: projectName,
      areaOffice: areaOffice,
      reportLinks: reportLinks,
    })
  }

  return cases
}

/**
 * Read AI-column smart chips / hyperlinks via Sheets API v4.
 * Returns an array aligned to sheet rows (0-based); missing rows are null.
 */
function fetchReportLinkCells_(spreadsheetId, sheetName, columnLetter) {
  var token = ScriptApp.getOAuthToken()
  var rangeA1 = "'" + String(sheetName).replace(/'/g, "''") + "'!" + columnLetter + ':' + columnLetter
  var apiUrl =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(spreadsheetId) +
    '?includeGridData=true&ranges=' +
    encodeURIComponent(rangeA1) +
    '&fields=' +
    encodeURIComponent(
      'sheets.data.rowData.values(formattedValue,hyperlink,chipRuns)',
    )

  var res = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
    },
    muteHttpExceptions: true,
  })

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    // Fall back to display-only links (url null) rather than failing the whole refresh.
    return []
  }

  var parsed = JSON.parse(res.getContentText())
  var rowData =
    parsed &&
    parsed.sheets &&
    parsed.sheets[0] &&
    parsed.sheets[0].data &&
    parsed.sheets[0].data[0] &&
    parsed.sheets[0].data[0].rowData
      ? parsed.sheets[0].data[0].rowData
      : []

  var cells = []
  for (var i = 0; i < rowData.length; i++) {
    var values = rowData[i] && rowData[i].values ? rowData[i].values : null
    cells[i] = values && values[0] ? values[0] : null
  }
  return cells
}

function parseReportLinks_(displayText, cellData) {
  var urls = []
  var seen = {}

  function addUrl(url) {
    var trimmed = String(url || '').trim()
    if (!trimmed || seen[trimmed]) {
      return
    }
    seen[trimmed] = true
    urls.push(trimmed)
  }

  if (cellData && cellData.hyperlink) {
    addUrl(cellData.hyperlink)
  }

  var chipRuns = (cellData && cellData.chipRuns) || []
  for (var i = 0; i < chipRuns.length; i++) {
    var chip = chipRuns[i] && chipRuns[i].chip
    if (chip && chip.richLinkProperties && chip.richLinkProperties.uri) {
      addUrl(chip.richLinkProperties.uri)
    }
  }

  var labels = String(displayText || '')
    .split(/\r?\n/)
    .map(function (part) {
      return String(part || '').trim()
    })
    .filter(function (part) {
      // Chip placeholders from API are often just "@"
      return part && part !== '@'
    })

  if (urls.length === 0 && labels.length === 0) {
    return []
  }

  if (urls.length === 0) {
    return labels.map(function (label) {
      return { label: label, url: null }
    })
  }

  return urls.map(function (url, index) {
    var label = labels[index] || labels[0] || 'Open report'
    return { label: label, url: url }
  })
}

function cellText_(row, columnIndex) {
  if (columnIndex == null || columnIndex < 0 || !row || row.length <= columnIndex) {
    return ''
  }
  return String(row[columnIndex] || '').trim()
}

function columnIndexToLetter_(index) {
  var n = index
  var label = ''
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label
    n = Math.floor(n / 26) - 1
  }
  return label
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

function commitJsonToGithub_(fileName, payload, message) {
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
  var path = prefix + fileName
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
    message: message,
    content: Utilities.base64Encode(
      JSON.stringify(payload, null, 2) + '\n',
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
