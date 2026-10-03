export type YearConfig = {
  spreadsheetId: string
  sheetName: string
  /** 0-based column index for Area office (column L) */
  areaOfficeColumnIndex: number
  /** 0-based column index for Visit person (column R) */
  visitPersonColumnIndex: number
}

export const YEAR_CONFIG: Record<number, YearConfig> = {
  2025: {
    spreadsheetId: '1lh2IS6CWxDi6f11tnT-1oRu6BL7mcGtBd4BK8H92zN0',
    sheetName: 'Office-Register',
    areaOfficeColumnIndex: 11,
    visitPersonColumnIndex: 17,
  },
}

export const AVAILABLE_YEARS = Object.keys(YEAR_CONFIG)
  .map(Number)
  .sort((a, b) => b - a)

export const DEFAULT_YEAR = AVAILABLE_YEARS[0] ?? 2025
