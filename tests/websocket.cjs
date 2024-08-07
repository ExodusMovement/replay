'use strict'

// Having it cjs because of a conditional import and node:test lifecycle bug with dynamic describe/test

/* eslint-disable unicorn/prefer-add-event-listener */
/* global WebSocket */

const { test } = require('node:test')
const assert = require('node:assert/strict')

const message = async (ee) => on(ee, 'message').then((event) => event.data)
const on = (ee, acc, rej = 'error') =>
  new Promise((resolve, reject) => {
    Object.assign(ee, { [`on${acc}`]: resolve, [`on${rej}`]: (err) => reject(err?.error || err) })
  })

test('static properties', () => {
  assert.equal(WebSocket.CONNECTING, 0)
  assert.equal(WebSocket.OPEN, 1)
  assert.equal(WebSocket.CLOSING, 2)
  assert.equal(WebSocket.CLOSED, 3)
})

// this fails on ws because of CloudFlare?
test('javascript.info /demo/hello', async (t) => {
  const socket = new WebSocket('wss://javascript.info/article/websocket/demo/hello', ['test'])
  assert.equal(socket.extensions, '')
  assert.equal(socket.protocol, '')
  assert.equal(socket.readyState, WebSocket.CONNECTING)

  // Attach a listener before .onmessage
  const listenerMessagesBefore = []
  socket.addEventListener('message', (event) => {
    assert.deepStrictEqual(listenerMessagesBefore, messages)
    listenerMessagesBefore.push(event.data)
    assert.notDeepStrictEqual(listenerMessagesBefore, messages)
  })

  const messages = []
  socket.onmessage = (event) => {
    messages.push(event.data)
    socket.close()
    assert.equal(socket.readyState, WebSocket.CLOSING)
  }

  // Attach a listener after .onmessage
  const listenerMessagesAfter = []
  socket.addEventListener('message', (event) => {
    assert.notDeepEqual(listenerMessagesAfter, messages)
    listenerMessagesAfter.push(event.data)
    assert.deepEqual(listenerMessagesAfter, messages)
  })

  try {
    await on(socket, 'open')
  } catch (err) {
    if (err.message === 'Unexpected server response: 200') {
      return t.skip('Server sent a 200 response, likely CloudFlare blocking us')
    }

    throw err
  }

  assert.equal(socket.protocol, 'test')
  assert.equal(socket.readyState, WebSocket.OPEN)
  assert.equal(messages.length, 0)
  assert.deepEqual(listenerMessagesBefore, messages)
  assert.deepEqual(listenerMessagesAfter, messages)

  assert.equal(socket.bufferedAmount, 0)
  socket.send('Hi there')
  assert.notEqual(socket.bufferedAmount, 0)
  assert.ok(socket.bufferedAmount >= 8)

  const result = await on(socket, 'close')

  assert.equal(result.type, 'close')
  assert.equal(socket.protocol, 'test')
  assert.equal(socket.readyState, WebSocket.CLOSED)
  assert.equal(messages.length, 1)
  assert.deepEqual(messages, ['Hello from server, there!'])
  assert.deepEqual(listenerMessagesBefore, messages)
  assert.deepEqual(listenerMessagesAfter, messages)
})

test('connection error', async () => {
  const socket = new WebSocket('wss://localhost:1/')
  assert.equal(socket.extensions, '')
  assert.equal(socket.protocol, '')
  assert.equal(socket.readyState, WebSocket.CONNECTING)

  const messages = []
  socket.onmessage = (event) => messages.push(event.data)

  const errorEvent = await on(socket, 'error', 'open') // Swapped on a purpose!

  assert.equal(errorEvent.type, 'error')
  assert.ok(errorEvent.error)
  assert.ok(errorEvent.error instanceof Error)
  assert.equal(typeof errorEvent.error.message, 'string')

  assert.equal(socket.protocol, '')
  assert.equal(messages.length, 0)
  assert.deepEqual(messages, [])
})

test('buffer/blob echo', { skip: !globalThis.Blob }, async () => {
  const socket = new WebSocket('wss://echo.websocket.org/')
  const messages = []
  socket.addEventListener('message', (event) => messages.push(event.data))

  assert.equal(socket.readyState, WebSocket.CONNECTING)

  await on(socket, 'open')
  assert.equal(socket.readyState, WebSocket.OPEN)
  assert.equal(messages.length, 0)

  assert.match(await message(socket), /^Request served by/)
  assert.equal(messages.length, 1)

  const toArrayBuffer = (t) => t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength)
  const byteSize = (x) => x.byteLength ?? x.size ?? x.length
  const toBuffer = (x) => {
    if (x instanceof Blob) return x.arrayBuffer().then((buf) => Buffer.from(buf)) // async
    return x.buffer ? Buffer.from(x.buffer, x.byteOffset, x.byteLength) : Buffer.from(x) // sync
  }

  const expectBufferResponse = async (input, type) => {
    socket.send(input)
    await expectBuffer(await message(socket), input, type)
  }

  const expectBuffer = async (data, input, type) => {
    assert.ok(data)
    // expect.toBe is cryptic on this: expect(Blob.prototype).toBe(ArrayBuffer.prototype)
    assert.equal(Object.getPrototypeOf(data), type.prototype)
    assert.equal(byteSize(data), byteSize(input))
    // expect.toEqual can't compare ArrayBuffer instances and always returns true!
    assert.deepEqual(await toBuffer(data), await toBuffer(input))
  }

  socket.binaryType = 'arraybuffer'
  assert.equal(socket.binaryType, 'arraybuffer')
  await expectBufferResponse('Hello here', String)
  await expectBufferResponse(Buffer.from('Hello there'), ArrayBuffer)
  await expectBufferResponse(new Uint8Array([3, 5, 7]), ArrayBuffer)
  await expectBufferResponse(new Uint32Array([2 ** 32 - 1, 2 ** 16, 2 ** 31]), ArrayBuffer)
  await expectBufferResponse(toArrayBuffer(new Uint8Array([1, 42, 0, 2])), ArrayBuffer)
  await expectBufferResponse(new Blob(['one', 'two']), ArrayBuffer)

  socket.binaryType = 'blob'
  assert.equal(socket.binaryType, 'blob')
  await expectBufferResponse('This is not a blob', String)
  await expectBufferResponse(Buffer.from('This is a blob'), Blob)
  await expectBufferResponse(new Uint8Array([11, 22, 44, 57]), Blob)
  await expectBufferResponse(new Uint32Array([2 ** 16, 2 ** 32 - 1, 0, 2 ** 31]), Blob)
  await expectBufferResponse(toArrayBuffer(new Uint8Array([51, 0, 53, 52])), Blob)
  await expectBufferResponse(new Blob(['three', 'four', 'five']), Blob)

  // Messages order for blobs (those are async to serialize)
  const arr = []
  await new Promise((resolve, reject) => {
    socket.onerror = reject
    socket.onmessage = (event) => {
      arr.push(event.data)
      if (arr.length === 3) resolve()
    }

    socket.send(new Blob(['Sending a Blob']))
    socket.send(Buffer.from('Sending a Buffer'))
    socket.send('Sending a string')
  })
  await expectBuffer(arr[0], Buffer.from('Sending a Blob'), Blob)
  await expectBuffer(arr[1], Buffer.from('Sending a Buffer'), Blob)
  assert.equal(arr[2], 'Sending a string')

  socket.close()
  assert.equal(socket.readyState, WebSocket.CLOSING)

  const result = await on(socket, 'close')
  assert.equal(result.type, 'close')
  assert.equal(socket.readyState, WebSocket.CLOSED)
  assert.equal(messages.length, 16) // 1 + 6 + 6 + 3
})
