// Copies the static data files the screens read from ../data into public/.
// Skipped quietly when ../data is not there (for example in a lone frontend copy).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'public'), { recursive: true })
for (const f of ['sample_timetable.json', 'backtest_result.json']) {
  const src = join(root, '..', 'data', f)
  if (existsSync(src)) {
    copyFileSync(src, join(root, 'public', f))
    console.log('synced', f)
  }
}
