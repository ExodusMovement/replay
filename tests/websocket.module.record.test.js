import { describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'

import * as replay from '../index.js'
import { dir as fixturesDir } from './fixtures/index.cjs'

const require = createRequire(import.meta.url) // need sync imports

describe('WebSocket (ws), recording', { skip: !globalThis.WebSocket }, () => {
  const file = path.join(fixturesDir, 'websocket.module.json')
  const log = []

  after(() => {
    // fs.writeFileSync(file, replay.prettyJSON(log))
    const expected = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cleanData = (data) =>
      typeof data === 'string' && data.startsWith('Request served by ')
        ? 'Request served by *'
        : data
    const cleanEntry = ({ at: _, data, ...entry }) => ({ data: cleanData(data), ...entry })
    const badUrl = 'wss://javascript.info/article/websocket/demo/hello' // known flaky with node-fetch, sometimes gets 200 (CloudFlare?)
    const cleanBadUrl = ({ url, ...rest }) => (url === badUrl ? { url } : { url, ...rest })
    const cleanLog = ({ log, ...rest }) => cleanBadUrl({ log: log.map(cleanEntry), ...rest })
    const noUndefined = (x) => JSON.parse(JSON.stringify(x))
    assert.deepEqual(noUndefined(log.map(cleanLog)), noUndefined(expected.map(cleanLog)))
  })

  globalThis.WebSocket = replay.WebSocketRecorder(log, { WebSocket })
  require('./websocket.cjs')
})
