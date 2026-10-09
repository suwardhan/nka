import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const targetDir = path.resolve(__dirname, '../../admin')
const targetDataDir = path.join(targetDir, 'data')
const preservedDataDir = path.resolve(__dirname, '../.preserved-admin-data')

if (!existsSync(distDir)) {
  console.error('Missing admin-app/dist. Run npm run build first.')
  process.exit(1)
}

// Keep existing admin/data — Vite public/ snapshots can lag behind
// GitHub-committed refreshes in admin/data/.
if (existsSync(targetDataDir)) {
  rmSync(preservedDataDir, { recursive: true, force: true })
  cpSync(targetDataDir, preservedDataDir, { recursive: true })
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
cpSync(distDir, targetDir, { recursive: true })

if (existsSync(preservedDataDir)) {
  rmSync(targetDataDir, { recursive: true, force: true })
  cpSync(preservedDataDir, targetDataDir, { recursive: true })
  rmSync(preservedDataDir, { recursive: true, force: true })
  console.log('Preserved existing admin/data snapshots')
}

// Note: GitHub Pages SPA deep-link fallback lives in repo-root 404.html
// (subdirectory 404.html is ignored by GitHub Pages).

console.log(`Copied admin build to ${targetDir}`)
