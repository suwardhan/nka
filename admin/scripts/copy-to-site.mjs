import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const targetDir = path.resolve(__dirname, '../../admin-site')

if (!existsSync(distDir)) {
  console.error('Missing admin/dist. Run npm run build first.')
  process.exit(1)
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
cpSync(distDir, targetDir, { recursive: true })

// GitHub Pages SPA fallback for client-side routes under /admin
copyFileSync(
  path.join(targetDir, 'index.html'),
  path.join(targetDir, '404.html'),
)

console.log(`Copied admin build to ${targetDir}`)
console.log('Serve or publish this folder as /admin on the static host.')
