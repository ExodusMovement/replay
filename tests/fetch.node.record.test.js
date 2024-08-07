import { describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (Node.js), recording', { skip: !globalThis.fetch }, () => {
  const file = path.join(fixturesDir, 'fetch.node.json')
  const log = []

  after(() => {
    // fs.writeFileSync(file, replay.prettyJSON(log))
    const expected = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cleanLog = ({ headers: _, ...rest }) => rest
    assert.deepEqual(JSON.parse(JSON.stringify(log.map(cleanLog))), expected.map(cleanLog))
  })

  globalThis.fetch = replay.fetchRecorder(log)
  require('./fetch.cjs')
})
