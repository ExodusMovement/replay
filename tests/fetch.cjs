'use strict'

// Having it cjs because of a conditional import and node:test lifecycle bug with dynamic describe/test

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { expect } = require('expect') // TODO: use asserts

const JSON_ERROR_REGEX = /(not valid JSON|^JSON Parse error|^Unexpected token .* in JSON)/

test('https://example.com', async () => {
  const res = await fetch('https://example.com')
  expect(res.status).toBe(200)
  expect(res.ok).toBe(true)
  expect(res.url).toBe('https://example.com/') // Normalized!
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  if (!globalThis.NODE_FETCH_BROKEN_CLONE) {
    // https://github.com/node-fetch/node-fetch/issues/1784
    await expect(res.clone().json()).rejects.toThrow(JSON_ERROR_REGEX)
  }

  expect(await res.text()).toMatch(/This domain is for use in illustrative examples in documents/)
})

test('https://jsonplaceholder.typicode.com/posts', async () => {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  expect(res.status).toBe(200)
  expect(res.ok).toBe(true)
  expect(res.url).toBe('https://jsonplaceholder.typicode.com/posts')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const posts = await res.json()
  expect(posts.length).toBe(100)
  expect(posts[99].userId).toBe(10)
})

test('https://jsonplaceholder.typicode.com/users with headers in plain object', async () => {
  const headers = { accept: 'application/json' }
  const res = await fetch('https://jsonplaceholder.typicode.com/users', { headers })
  expect(res.status).toBe(200)
  expect(res.ok).toBe(true)
  expect(res.url).toBe('https://jsonplaceholder.typicode.com/users')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const users = await res.json()
  expect(users.length).toBe(10)
  expect(new Map(res.headers).get('content-type')).toBe('application/json; charset=utf-8')
})

const testHeaders = typeof Headers === 'undefined' ? test.skip : test
testHeaders('https://jsonplaceholder.typicode.com/users/2 with headers in Headers', async () => {
  const headers = new Headers()
  headers.append('accept', 'application/json')
  const res = await fetch('https://jsonplaceholder.typicode.com/users/2', { headers })
  expect(res.status).toBe(200)
  expect(res.ok).toBe(true)
  expect(res.url).toBe('https://jsonplaceholder.typicode.com/users/2')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  const user = await res.json()
  expect(user.name).toBe('Ervin Howell')
  expect(res.headers.constructor).toBe(Headers)
  expect(res.headers.get('ConTent-tYpE')).toBe('application/json; charset=utf-8')
})

test('https://example.com/404', async () => {
  const res = await fetch('https://example.com/404')
  expect(res.status).toBe(404)
  expect(res.ok).toBe(false)
  expect(res.url).toBe('https://example.com/404')
  assert(['basic', 'default'].includes(res.type)) // 'basic' for builtin fetch, 'default' for node-fetch
  if (!globalThis.NODE_FETCH_BROKEN_CLONE) {
    // https://github.com/node-fetch/node-fetch/issues/1784
    await expect(res.clone().json()).rejects.toThrow(JSON_ERROR_REGEX)
  }

  expect(await res.text()).toMatch(/This domain is for use in illustrative examples in documents/) // same text
})
