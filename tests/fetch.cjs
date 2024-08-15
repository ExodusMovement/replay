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

test('POST https://jsonplaceholder.typicode.com/posts with JSON', async () => {
  const data = { title: 'foo', body: 'bar', userId: 1 }
  const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-type': 'application/json; charset=UTF-8' },
  })
  assert.equal(res.status, 201)
  assert.equal(res.statusText, 'Created')
  assert.equal(res.ok, true)
  const post = await res.json()
  assert.deepEqual(post, { ...data, id: 101 })
})

const testFormData = typeof FormData === 'undefined' ? test.skip : test
testFormData('POST https://dummyjson.com/posts/add with FormData', async () => {
  const data = new FormData()
  data.set('title', 'awesome')
  data.set('userId', 42)
  const res = await fetch('https://dummyjson.com/posts/add', { method: 'POST', body: data })
  assert.equal(res.status, 201)
  assert.equal(res.statusText, 'Created')
  assert.equal(res.ok, true)
  const post = await res.json()
  assert.deepEqual(post, { title: 'awesome', userId: '42', id: 252 })
})

test('GET https://dummyjson.com/image/2 arrayBuffer', async () => {
  const res = await fetch('https://dummyjson.com/image/2')
  assert.equal(res.status, 200)
  if (typeof Headers !== 'undefined') {
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(res.headers.get('content-length'), '95')
  }

  const buf = await res.arrayBuffer()
  assert.ok(Object.getPrototypeOf(buf) === ArrayBuffer.prototype)
  assert.equal(buf.byteLength, 95)
  assert.deepEqual(
    Buffer.from(buf).toString('base64'),
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4derUfxBmgDEAd+gNdaE1fMIAAAAASUVORK5CYII='
  )
})

const testBlob = typeof Blob === 'undefined' ? test.skip : test
testBlob('GET https://dummyjson.com/image/1 blob', async () => {
  const res = await fetch('https://dummyjson.com/image/1')
  assert.equal(res.status, 200)
  if (typeof Headers !== 'undefined') {
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(res.headers.get('content-length'), '91')
  }

  const blob = await res.blob()
  assert.equal(blob.constructor.name, 'Blob') // node-fetch Blob and global Blob might differ
  assert.equal(blob.size, 91)
  assert.equal(blob.type, 'image/png')
  const buf = await blob.arrayBuffer()
  assert.equal(buf.byteLength, 91)
  assert.deepEqual(
    Buffer.from(buf).toString('base64'),
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGM4derUfwAIHgNeAOmyrwAAAABJRU5ErkJggg=='
  )
})

test('connection refused error', async () => {
  const request = fetch('http://127.0.0.1/')
  await assert.rejects(request, /(fetch failed|ECONNREFUSED)/)
})
