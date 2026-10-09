export type YearConfig = {
  spreadsheetId: string
  sheetName: string
  /** 0-based column index for Area office */
  areaOfficeColumnIndex: number
  /** 0-based column index for Visit person */
  visitPersonColumnIndex: number
  /** 0-based column index for Report prepared by */
  reportPreparedByColumnIndex: number
  /**
   * Case-search columns (Applicant A, Address I, Project J, Report link AI).
   * Only set for years where those columns are confirmed (currently 2024–2026).
   * TODO: add 2021–2023 once column layouts are verified.
   */
  caseSearch?: {
    applicantColumnIndex: number
    addressColumnIndex: number
    projectColumnIndex: number
    reportLinkColumnIndex: number
  }
}

/** Convert 0-based column index to spreadsheet letter (0 -> A, 32 -> AG). */
export function columnIndexToLetter(index: number): string {
  let n = index
  let label = ''
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

export const YEAR_CONFIG: Record<number, YearConfig> = {
  2026: {
    spreadsheetId: '1QPntYKdKXIZM2UcTn_KrBOnsJ_vEEia-BSGs6DMMQr0',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 11, // L
    visitPersonColumnIndex: 17, // R
    reportPreparedByColumnIndex: 32, // AG
    caseSearch: {
      applicantColumnIndex: 0, // A
      addressColumnIndex: 8, // I
      projectColumnIndex: 9, // J
      reportLinkColumnIndex: 34, // AI
    },
  },
  2025: {
    spreadsheetId: '1lh2IS6CWxDi6f11tnT-1oRu6BL7mcGtBd4BK8H92zN0',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 11, // L
    visitPersonColumnIndex: 17, // R
    reportPreparedByColumnIndex: 32, // AG
    caseSearch: {
      applicantColumnIndex: 0, // A
      addressColumnIndex: 8, // I
      projectColumnIndex: 9, // J
      reportLinkColumnIndex: 34, // AI
    },
  },
  2024: {
    spreadsheetId: '1eEv8bD1qRsNrkWWpmaseH1nGsCQQMyDygEGnvNtufdo',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 11, // L
    visitPersonColumnIndex: 17, // R
    reportPreparedByColumnIndex: 32, // AG
    caseSearch: {
      applicantColumnIndex: 0, // A
      addressColumnIndex: 8, // I
      projectColumnIndex: 9, // J
      reportLinkColumnIndex: 34, // AI
    },
  },
  2023: {
    spreadsheetId: '14BJqq9GgMsysoROc8pfBB-8MpGWZXaeNkllTL_SzTQA',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 10, // K
    visitPersonColumnIndex: 13, // N
    reportPreparedByColumnIndex: 28, // AC
  },
  2022: {
    spreadsheetId: '16qZ3zcG2pvmesNqGuHn3xs4qK8gT_uamqdzvnkOYWNw',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 10, // K
    visitPersonColumnIndex: 13, // N
    reportPreparedByColumnIndex: 28, // AC
  },
  2021: {
    spreadsheetId: '1GD4z3kUB7_c-QsCj3Vzlm-74f9zgjhWeqKNyAtSCXdo',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 10, // K
    visitPersonColumnIndex: 13, // N
    reportPreparedByColumnIndex: 28, // AC
  },
}

export const AVAILABLE_YEARS = Object.keys(YEAR_CONFIG)
  .map(Number)
  .sort((a, b) => b - a)

export const DEFAULT_YEAR = AVAILABLE_YEARS[0] ?? 2025

/** Years with a case-search index (Applicant / Address / Project / Report link). */
export const CASE_SEARCH_YEARS = AVAILABLE_YEARS.filter(
  (year) => YEAR_CONFIG[year]?.caseSearch,
)
