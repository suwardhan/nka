/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_PASSCODE: string
  readonly VITE_SHEETS_PROXY_URL: string
  readonly VITE_SHEETS_PROXY_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
