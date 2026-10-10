/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Cloudflare Worker admin API (no trailing slash). */
  readonly VITE_ADMIN_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
