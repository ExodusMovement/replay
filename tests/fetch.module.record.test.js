import { describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import fetch, { Headers } from 'node-fetch'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (node-fetch), recording', () => {
  const file = path.join(fixturesDir, 'fetch.module.json')
  const log = []

  after(() => {
    // fs.writeFileSync(file, replay.prettyJSON(log))
    const expected = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cleanLog = ({ headers: _, ...rest }) => rest
    assert.deepEqual(JSON.parse(JSON.stringify(log.map(cleanLog))), expected.map(cleanLog))
  })

  Object.assign(globalThis, { Headers }) // only for tests to check this for equality, not used in recorder
  globalThis.fetch = replay.fetchRecorder(log, { fetch })
  globalThis.NODE_FETCH_BROKEN_CLONE = true // https://github.com/node-fetch/node-fetch/issues/1784
  require('./fetch.cjs')
})
