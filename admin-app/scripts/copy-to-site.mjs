import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const targetDir = path.resolve(__dirname, '../../admin')

if (!existsSync(distDir)) {
  console.error('Missing admin-app/dist. Run npm run build first.')
  process.exit(1)
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
cpSync(distDir, targetDir, { recursive: true })

// Note: GitHub Pages SPA deep-link fallback lives in repo-root 404.html
// (subdirectory 404.html is ignored by GitHub Pages).

console.log(`Copied admin build to ${targetDir}`)
