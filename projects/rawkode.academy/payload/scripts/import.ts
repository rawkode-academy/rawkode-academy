import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = process.env.POC_URL ?? 'http://127.0.0.1:3100'
const url = new URL(base)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('This experimental importer only targets a loopback Worker. Remote import is deliberately disabled.')
let localCredentials: { email?: string; password?: string } = {}
if (!process.env.POC_EMAIL || !process.env.POC_PASSWORD) {
  try { localCredentials = JSON.parse(await readFile(new URL('../.runtime/admin.json', import.meta.url), 'utf8')) }
  catch { /* An environment-only setup does not need the ignored runtime file. */ }
}
const email = process.env.POC_EMAIL ?? localCredentials.email
const password = process.env.POC_PASSWORD ?? localCredentials.password
if (!email || !password) throw new Error('Set POC_EMAIL and POC_PASSWORD to your local experimental administrator credentials.')
const login = await fetch(new URL('/api/users/login', base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
if (!login.ok) throw new Error(`Local admin login failed: HTTP ${login.status}`)
const cookies = login.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
if (!cookies) throw new Error('Local admin login did not return an authentication cookie')
const fixturePath = process.argv.find(arg => arg.startsWith('--file='))?.slice('--file='.length) ?? fileURLToPath(new URL('../fixtures/catalogue.json', import.meta.url))
const snapshot = JSON.parse(await readFile(fixturePath, 'utf8'))
const response = await fetch(new URL('/api/poc/import', base), { method: 'POST', headers: { 'content-type': 'application/json', origin:base, cookie: cookies }, body: JSON.stringify({ snapshot, dryRun: process.argv.includes('--dry-run') }) })
const body = await response.text()
if (!response.ok) throw new Error(`Import failed: HTTP ${response.status}: ${body}`)
console.log(JSON.stringify(JSON.parse(body), null, 2))
