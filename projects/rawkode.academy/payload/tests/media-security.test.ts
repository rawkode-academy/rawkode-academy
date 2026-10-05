import assert from 'node:assert/strict'
import test from 'node:test'
import { filterExternalFileHeaders } from '../src/media-security'

test('external media fetches never forward authentication headers', () => {
  const filtered = filterExternalFileHeaders({ cookie: '__Host-poc-oidc-session=secret', authorization: 'Bearer secret', 'x-api-key': 'secret', accept: 'video/*' }, { isSameOrigin: false })
  assert.deepEqual(filtered, { accept: 'video/*' })
})

test('same-origin media fetches retain caller headers', () => {
  const headers = { cookie: 'session=local', accept: 'video/*' }
  assert.deepEqual(filterExternalFileHeaders(headers, { isSameOrigin: true }), headers)
})
