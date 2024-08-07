'use strict'

// Having it cjs because of a conditional import and node:test lifecycle bug with dynamic describe/test

const { test } = require('node:test')
const assert = require('node:assert/strict')

const JSON_ERROR_REGEX = /(not valid JSON|^JSON Parse error|^Unexpected token .* in JSON)/

test('https://example.com', async () => {
  const res = await fetch('https://example.com')
  assert.equal(res.status, 200)
  assert.equal(res.ok, true)
  assert.equal(res.url, 'https://example.com/') // Normalized!
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  if (!globalThis.NODE_FETCH_BROKEN_CLONE) {
    // https://github.com/node-fetch/node-fetch/issues/1784
    await assert.rejects(res.clone().json(), (err) => JSON_ERROR_REGEX.test(err.message))
  }

  assert.match(await res.text(), /This domain is for use in illustrative examples in documents/)
})

test('https://jsonplaceholder.typicode.com/posts', async () => {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  assert.equal(res.status, 200)
  assert.equal(res.ok, true)
  assert.equal(res.url, 'https://jsonplaceholder.typicode.com/posts')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const posts = await res.json()
  assert.equal(posts.length, 100)
  assert.equal(posts[99].userId, 10)
})

test('https://jsonplaceholder.typicode.com/users with headers in plain object', async () => {
  const headers = { accept: 'application/json' }
  const res = await fetch('https://jsonplaceholder.typicode.com/users', { headers })
  assert.equal(res.status, 200)
  assert.equal(res.ok, true)
  assert.equal(res.url, 'https://jsonplaceholder.typicode.com/users')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const users = await res.json()
  assert.equal(users.length, 10)
  assert.equal(new Map(res.headers).get('content-type'), 'application/json; charset=utf-8')
})

const testHeaders = typeof Headers === 'undefined' ? test.skip : test
testHeaders('https://jsonplaceholder.typicode.com/users/2 with headers in Headers', async () => {
  const headers = new Headers()
  headers.append('accept', 'application/json')
  const res = await fetch('https://jsonplaceholder.typicode.com/users/2', { headers })
  assert.equal(res.status, 200)
  assert.equal(res.ok, true)
  assert.equal(res.url, 'https://jsonplaceholder.typicode.com/users/2')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const user = await res.json()
  assert.equal(user.name, 'Ervin Howell')
  assert.equal(res.headers.constructor, Headers)
  assert.equal(res.headers.get('ConTent-tYpE'), 'application/json; charset=utf-8')
})

test('https://example.com/404', async () => {
  const res = await fetch('https://example.com/404')
  assert.equal(res.status, 404)
  assert.equal(res.ok, false)
  assert.equal(res.url, 'https://example.com/404')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  if (!globalThis.NODE_FETCH_BROKEN_CLONE) {
    // https://github.com/node-fetch/node-fetch/issues/1784
    await assert.rejects(res.clone().json(), (err) => JSON_ERROR_REGEX.test(err.message))
  }

  assert.match(await res.text(), /This domain is for use in illustrative examples in documents/) // same text
})
