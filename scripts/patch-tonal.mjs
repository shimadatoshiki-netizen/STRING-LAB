import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules')
const names = ['tonal']
const scoped = path.join(root, '@tonaljs')
if (fs.existsSync(scoped)) {
  for (const entry of fs.readdirSync(scoped)) names.push(path.join('@tonaljs', entry))
}

for (const name of names) {
  const declaration = path.join(root, name, 'dist', 'index.d.mts')
  const target = path.join(root, name, 'dist', 'index.d.ts')
  if (fs.existsSync(declaration) && !fs.existsSync(target)) {
    fs.copyFileSync(declaration, target)
  }
}
