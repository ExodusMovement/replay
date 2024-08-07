import { describe } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url) // need sync imports

describe('fetch (Node.js)', { skip: !globalThis.fetch }, () => {
  require('./fetch.cjs')
})
