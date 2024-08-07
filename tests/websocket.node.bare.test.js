import { describe } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url) // need sync imports

describe('WebSocket (Node.js)', { skip: !globalThis.WebSocket }, () => {
  require('./websocket.cjs')
})
