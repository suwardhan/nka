import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const targetDir = path.resolve(__dirname, '../../admin')
const targetDataDir = path.join(targetDir, 'data')

if (!existsSync(distDir)) {
  console.error('Missing admin-app/dist. Run npm run build first.')
  process.exit(1)
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
cpSync(distDir, targetDir, { recursive: true })

// Snapshots are private (Cloudflare Worker + KV). Do not publish JSON under /admin/data.
rmSync(targetDataDir, { recursive: true, force: true })
mkdirSync(targetDataDir, { recursive: true })
writeFileSync(
  path.join(targetDataDir, 'README.md'),
  `# Private admin data

Dashboard and case snapshots are no longer published here.

They are served by the Cloudflare Worker at \`/admin-api\` after Cloudflare Access login.
`,
  'utf8',
)

// Note: GitHub Pages SPA deep-link fallback lives in repo-root 404.html
// (subdirectory 404.html is ignored by GitHub Pages).

console.log(`Copied admin build to ${targetDir} (no public data JSON)`)
