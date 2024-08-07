import { describe } from 'node:test'
import { createRequire } from 'node:module'
import WebSocket from 'ws'

const require = createRequire(import.meta.url) // need sync imports

describe('WebSocket (ws)', () => {
  Object.assign(globalThis, { WebSocket })
  require('./websocket.cjs')
})
