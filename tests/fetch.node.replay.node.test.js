import { describe } from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (Node.js), replaying (Node.js Response/Headers)', () => {
  const file = path.join(fixturesDir, 'fetch.node.json')
  const log = JSON.parse(fs.readFileSync(file, 'utf8'))
  globalThis.fetch = replay.fetchReplayer(log)
  require('./fetch.cjs')
})
