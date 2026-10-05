import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { klusteredTables } from '../src/klustered-content'

type D1Result = { results?: Record<string, unknown>[]; success?: boolean; errors?: unknown[] }

const args = process.argv.slice(2)
const outputPath = path.resolve(process.cwd(), args.find(argument => !argument.startsWith('--')) ?? process.env.KLUSTERED_SNAPSHOT_PATH ?? '.runtime/klustered.json')
const remote = args.includes('--remote') || process.env.KLUSTERED_REMOTE !== 'false'
const includeSensitive = args.includes('--include-sensitive') || process.env.KLUSTERED_INCLUDE_SENSITIVE === 'true'
const database = process.env.KLUSTERED_DATABASE ?? 'platform-brackets'
const configPath = path.resolve(process.cwd(), process.env.KLUSTERED_WRANGLER_CONFIG ?? '../../../projects/rawkode.academy/platform/brackets/write-model/wrangler.jsonc')

function runWrangler(table: string): Promise<string> {
  const command = process.env.WRANGLER_BIN ?? 'bun'
  const commandArgs = process.env.WRANGLER_BIN ? ['d1', 'execute', database] : ['x', 'wrangler', 'd1', 'execute', database]
  const orderBy: Record<string, string> = { team_members: 'team_id, competitor_id' }
  commandArgs.push('--command', `SELECT * FROM "${table}" ORDER BY ${orderBy[table] ?? (table === 'team_invites' ? 'token' : 'id')}`, '--config', configPath, '--json')
  if (remote) commandArgs.push('--remote')
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`Wrangler D1 export failed for ${table} (exit ${code}): ${stderr.trim() || stdout.trim()}`))
    })
  })
}

function extractRows(output: string, table: string): Record<string, unknown>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch (error) {
    throw new Error(`Wrangler returned non-JSON output for ${table}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const candidates = Array.isArray(parsed) ? parsed : [parsed]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && Array.isArray((candidate as D1Result).results)) return (candidate as D1Result).results ?? []
  }
  throw new Error(`Wrangler JSON output for ${table} did not contain a results array`)
}

const snapshot: Record<string, Record<string, unknown>[]> = {}
const tables = includeSensitive ? klusteredTables : klusteredTables.filter(table => table !== 'team_invites' && table !== 'registrations')
for (const table of tables) {
  process.stderr.write(`Exporting ${table} from ${database}${remote ? ' (remote)' : ''}\n`)
  snapshot[table] = extractRows(await runWrangler(table), table)
}

function timestampValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value !== 'string' || !value) return undefined
  const numeric = Number(value)
  if (Number.isSafeInteger(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

const derivedSequence = Math.max(1, ...Object.values(snapshot).flatMap(rows => rows.flatMap(row => ['updated_at', 'created_at', 'submitted_at', 'recorded_at', 'reviewed_at', 'revoked_at'].map(field => timestampValue(row[field])).filter((value): value is number => value !== undefined))))
const configuredSequence = process.env.KLUSTERED_CONTENT_SEQUENCE ? Number(process.env.KLUSTERED_CONTENT_SEQUENCE) : undefined
const sequence = configuredSequence && Number.isSafeInteger(configuredSequence) && configuredSequence > 0 ? configuredSequence : derivedSequence

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ ...snapshot, __meta: { sequence, includeSensitive } }, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, database, remote, includeSensitive, sequence, tables: Object.fromEntries(Object.entries(snapshot).map(([table, rows]) => [table, rows.length])) }, null, 2))
