import { describe } from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { Response, Headers, FormData } from 'node-fetch'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (node-fetch), replaying (node-fetch Response/Headers/FormData)', () => {
  const file = path.join(fixturesDir, 'fetch.module.json')
  const log = JSON.parse(fs.readFileSync(file, 'utf8'))
  Object.assign(globalThis, { Response, Headers, FormData })
  globalThis.fetch = replay.fetchReplayer(log)
  require('./fetch.cjs')
})
