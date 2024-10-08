import { describe } from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (Node.js), replaying (no Response/Headers/FormData/fetch)', () => {
  const file = path.join(fixturesDir, 'fetch.node.json')
  const log = JSON.parse(fs.readFileSync(file, 'utf8'))
  delete globalThis.Response
  delete globalThis.Headers
  delete globalThis.FormData
  delete globalThis.fetch
  globalThis.fetch = replay.fetchReplayer(log)
  require('./fetch.cjs')
})
