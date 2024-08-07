import { describe } from 'node:test'
import { createRequire } from 'node:module'
import fetch, { Headers } from 'node-fetch'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (node-fetch)', () => {
  Object.assign(globalThis, { fetch, Headers })
  require('./fetch.cjs')
})
