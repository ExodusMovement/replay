import { isPlainObject, prettyJSON, keySortedJSON, serializeBody, deserializeBody } from './util.js'

function serializeHeaders(headers) {
  if (!headers || Array.isArray(headers)) return headers
  if (isPlainObject(headers)) return Object.entries(headers)
  return [...headers]
}

const sortHeaders = (headers) => {
  if (!headers) return headers
  const clone = [...headers]
  return headers.sort((a, b) => {
    if (a[0] < b[0]) return -1
    if (a[0] > b[0]) return 1
    return clone.indexOf(a) - clone.indexOf(b)
  })
}

const serializeRequest = async (resource, options = {}) => {
  const serializable = Object.entries(options).filter(([key, value]) => {
    if (key === 'body' || key === 'headers') return false // included directly
    if (key === 'trailers') throw new Error('Trailers not supported in this version') // not in spec (yet?)
    if (key === 'signal') return false // ignored
    if (!value || ['string', 'number', 'boolean'].includes(typeof value)) return true
    throw new Error(`Can not process option ${key} with value type ${typeof value}`)
  })

  return {
    resource: `${resource}`,
    options: {
      ...Object.fromEntries(serializable),
      body: await serializeBody(options.body),
      headers: sortHeaders(serializeHeaders(options.headers)),
    },
  }
}

function maybeText(response) {
  // Doesn't have to be strong, this just avoids attempting to .text() on certain response types
  try {
    const type = response.headers.get('content-type').trim().split(';')[0]
    if (type.startsWith('image/') && !type.endsWith('+xml')) return false
    if (type.startsWith('audio/') || type.startsWith('video/')) return false
  } catch {}

  return true
}

async function serializeResponseBody(response) {
  try {
    if (response.headers.get('content-type').trim().split(';')[0] === 'application/json') {
      return { bodyType: 'json', body: await response.clone().json() }
    }
  } catch {}

  if (maybeText(response)) {
    const text = await response.clone().text()
    if (!text.includes('\uFFFD')) return { bodyType: 'text', body: text }
  }

  const buffer = await response.clone().arrayBuffer()
  return { bodyType: 'binary', body: await serializeBody(buffer) }
}

function deserializeResponseBody(body, bodyType) {
  if (bodyType === 'text') return body
  if (bodyType === 'json') return prettyJSON(body) // need to re-encode it as clone() exists
  if (bodyType === 'binary' && body?.type === 'ArrayBuffer') return deserializeBody(body)
  throw new Error('Unexpected bodyType in fetch recording log')
}

const serializeResponse = async (resource, options = {}, response) => {
  if (!['default', 'basic'].includes(response.type)) {
    throw new Error(`Can not record fetch response, unexpected type: ${response.type}`)
  }

  return {
    request: await serializeRequest(resource, options),
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: [...response.headers],
    url: response.url,
    redirected: response.redirected,
    type: response.type,
    ...(await serializeResponseBody(response)),
  }
}

function makeResponseBase(bodyType, body, init) {
  if (bodyType === 'json' && Response.json) return Response.json(body, init)
  if (bodyType === 'text' && Response.text) return Response.text(body, init)
  if (bodyType === 'json') return new Response(prettyJSON(body), init)
  if (bodyType === 'text') return new Response(body, init)
  if (bodyType === 'binary' && body?.type === 'ArrayBuffer') {
    return new Response(deserializeBody(body), init)
  }

  throw new Error('Unexpected bodyType')
}

function makeResponse({ bodyType, body }, headers, { status, statusText, ok, ...extra }) {
  // init supports only { status, statusText, headers } per spec, we have to restore the rest manually
  const response = makeResponseBase(bodyType, body, { status, statusText, headers })
  if (response.ok !== ok) throw new Error('Unexpected: ok mismatch')
  if (Object.hasOwn(extra, 'trailers')) throw new Error('Trailers not supported in this version')
  // We have { url, redirected, type } to set here
  const wrap = ([name, value]) => [name, { get: () => value, enumerable: true }]
  Object.defineProperties(response, Object.fromEntries(Object.entries(extra).map((el) => wrap(el))))
  return response
}

export function fetchRecorder(log, { fetch: _fetch = globalThis.fetch?.bind?.(globalThis) } = {}) {
  if (!Array.isArray(log)) throw new Error('log should be passed')
  if (!_fetch) throw new Error('No fetch implementation passed, no global fetch exists')
  return async function fetch(resource, options) {
    const res = await _fetch(resource, options)
    log.push(await serializeResponse(resource, options, res))
    return res
  }
}

export function fetchReplayer(log) {
  if (!Array.isArray(log)) throw new Error('log should be passed')
  log = log.map((entry) => ({ _request: keySortedJSON(entry.request), ...entry })) // cloned as we mutate it
  return async function fetch(resource, options = {}) {
    const request = keySortedJSON(await serializeRequest(resource, options))
    const id = log.findIndex((entry) => entry._request === request)
    if (id < 0) throw new Error(`Request to ${resource} not found, ${log.length} more entries left`)
    const [entry] = log.splice(id, 1)
    const { status, statusText, ok, url, redirected, type, headers = [], body, bodyType } = entry
    const props = { status, statusText, ok, url, redirected, type }

    try {
      // Try to return a native Response
      if (typeof Response !== 'undefined') return makeResponse({ body, bodyType }, headers, props)
    } catch {} // passthrough and return a plain object

    const data = deserializeResponseBody(body, bodyType)
    const getText = () => (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'))
    const bufferToAB = (buf) => buf.buffer.slice(0, buf.byteOffset, buf.byteOffset + buf.byteLength)
    const getAB = () => (typeof data === 'string' ? bufferToAB(Buffer.from(data)) : data.slice(0)) // eslint-disable-line unicorn/prefer-spread
    const getHeaders = () => (typeof Headers === 'undefined' ? [...headers] : new Headers(headers))
    const cType = () => getHeaders().get?.('content-type') ?? new Map(headers).get('content-type')
    const fallbackResponse = () => ({
      ...props,
      text: async () => getText(),
      json: async () => JSON.parse(getText()),
      arrayBuffer: async () => getAB(),
      blob: () => new Blob([data], { type: cType() }),
      headers: getHeaders(),
      clone: () => fallbackResponse(),
      get body() {
        if (typeof ReadableStream !== 'undefined') return { locked: false } // just trigger browser detection to make certain clients use .json() instead
        return ReadableStream.from(new Uint8Array(getAB()))
      },
    })
    return fallbackResponse()
  }
}
