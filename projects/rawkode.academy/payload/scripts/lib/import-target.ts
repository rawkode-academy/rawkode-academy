import { execFileSync } from 'node:child_process'
import type { CollectionSlug, Payload } from 'payload'
import type { TargetName } from './remote-target'
import { TargetError } from './remote-target'

export type ImportTarget = Exclude<TargetName, 'preview'>
const importTargets: readonly ImportTarget[] = ['local', 'rehearsal', 'pr-preview', 'production']
export const PRODUCTION_CONFIRMATION = 'rawkode-academy-payload'

export type ProductionConfirmation = { variable: string; flag: string; value: string }
/** Static content: the first production window. */
export const STATIC_PRODUCTION_CONFIRMATION: ProductionConfirmation = Object.freeze({ variable: 'CONFIRM_PRODUCTION_IMPORT', flag: '--confirm-production', value: PRODUCTION_CONFIRMATION })
/**
 * Klustered has its own token, so confirming the static window never also
 * confirms a Klustered production import.
 */
export const KLUSTERED_PRODUCTION_CONFIRMATION: ProductionConfirmation = Object.freeze({ variable: 'CONFIRM_PRODUCTION_KLUSTERED_IMPORT', flag: '--confirm-production-klustered', value: 'rawkode-academy-payload-klustered' })

const remoteFlagGuidance = '--remote is no longer supported: it resolved local or preview bindings, never production. Use --target=local, --target=rehearsal (with REHEARSAL_D1_ID and REHEARSAL_R2_BUCKET) or --target=production (with CONFIRM_PRODUCTION_IMPORT=rawkode-academy-payload).'

/** Parse --target. Absent means local; the shared Preview is never an import target. */
export function parseImportTarget(argv: readonly string[]): ImportTarget {
  if (argv.some(argument => /^--remote(=|$)/.test(argument))) throw new TargetError(remoteFlagGuidance)
  const values = argv.flatMap((argument, index) => {
    if (argument.startsWith('--target=')) return [argument.slice('--target='.length)]
    if (argument === '--target') return [argv[index + 1] ?? '']
    return []
  })
  if (values.length > 1) throw new TargetError('Pass --target once')
  const value = values[0] ?? 'local'
  if (value === 'preview') throw new TargetError('The shared preview D1 holds live review data and has no reset path; use --target=pr-preview for the disposable PR/SHA-bound D1/R2 pair.')
  if (!importTargets.includes(value as ImportTarget)) throw new TargetError(`Unknown --target=${value}. Expected one of ${importTargets.join(', ')}.`)
  return value as ImportTarget
}

/** Positional arguments, skipping flags and the value of a separate `--target <value>`. */
export function positionalArguments(argv: readonly string[]): string[] {
  return argv.filter((argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--target')
}

export type Watermark = { gitSha: string; sequence: number; sequenceSource: 'env' | 'snapshot' | 'git' | 'default' }

export type ProductionGateInput = {
  target: ImportTarget
  argv: readonly string[]
  env: Record<string, string | undefined>
  gitClean: boolean
  includeSensitive?: boolean
  /** Name of the environment variable that records the watermark for this source. */
  sequenceVariable: string
  watermark: Watermark
  /** Lowest sequence that is not stale relative to the source (for example the git commit time). */
  minimumSequence?: number
  /** Defaults to the static content token. */
  confirmation?: ProductionConfirmation
}

/**
 * Production imports are an explicit, recorded operator action. Every check runs
 * before the platform proxy is created, so a refused run never opens a remote
 * connection.
 */
export function assertProductionImportAllowed(input: ProductionGateInput): void {
  if (input.target !== 'production') return
  const problems: string[] = []
  const confirmation = input.confirmation ?? STATIC_PRODUCTION_CONFIRMATION
  const flag = input.argv.find(argument => argument.startsWith(`${confirmation.flag}=`))?.slice(confirmation.flag.length + 1)
  if ((flag ?? input.env[confirmation.variable]) !== confirmation.value) problems.push(`confirm with ${confirmation.variable}=${confirmation.value} or ${confirmation.flag}=${confirmation.value}`)
  if (!input.gitClean) problems.push('run from a clean git tree so the watermark identifies the imported source exactly')
  if (input.includeSensitive) problems.push('--include-sensitive is never allowed for production; the first production window imports static content only')
  // A derived default is fine for local and rehearsal runs. Production records
  // the watermark the operator chose, so the evidence names it explicitly.
  if (input.watermark.sequenceSource === 'default' || input.watermark.sequenceSource === 'git') problems.push(`record the watermark explicitly with ${input.sequenceVariable}`)
  if (input.minimumSequence !== undefined && input.watermark.sequence < input.minimumSequence) problems.push(`${input.sequenceVariable}=${input.watermark.sequence} is older than the source watermark ${input.minimumSequence}`)
  if (problems.length) throw new TargetError(`Refusing the production import: ${problems.join('; ')}.`)
}

/**
 * A new sequence must move the stored watermark forward. Re-running the same
 * sequence is only a resume of an interrupted run and must be asked for.
 */
export function assertSequenceAdvances(sequence: number, storedMaximum: number | null, options: { resume?: boolean } = {}): void {
  if (storedMaximum === null) return
  if (sequence < storedMaximum) throw new TargetError(`Sequence ${sequence} is lower than the stored watermark ${storedMaximum}; the target already holds newer source data.`)
  if (sequence === storedMaximum && !options.resume) throw new TargetError(`Sequence ${sequence} equals the stored watermark. Pass --resume to finish an interrupted run at the same watermark, or record a higher sequence.`)
}

export function resolveSequence(value: string | undefined, fallback: { sequence: number; source: Watermark['sequenceSource'] }): { sequence: number; sequenceSource: Watermark['sequenceSource'] } {
  if (value === undefined || value.trim() === '') return { sequence: fallback.sequence, sequenceSource: fallback.source }
  const sequence = Number(value)
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new TargetError(`Sequence must be a positive safe integer, got ${JSON.stringify(value)}`)
  return { sequence, sequenceSource: 'env' }
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function gitSha(cwd: string): string {
  return git(cwd, ['rev-parse', 'HEAD'])
}

export function gitTreeClean(cwd: string): boolean {
  return git(cwd, ['status', '--porcelain', '--untracked-files=normal']) === ''
}

/** max(commit time) over the given paths, in seconds. Paths outside the repository contribute 0. */
export function gitCommitWatermark(cwd: string, paths: string[]): number {
  const times = paths.map(candidate => {
    try { return Number(git(cwd, ['log', '-1', '--format=%ct', '--', candidate]) || 0) }
    catch { return 0 }
  })
  return Math.max(0, ...times)
}

type PayloadUser = NonNullable<Parameters<Payload['find']>[0]['user']>

/** Highest sourceSequence already written by this source system, or null for an empty target. */
export async function storedMaxSequence(payload: Payload, user: PayloadUser, collections: readonly string[], sourceSystem: string): Promise<number | null> {
  let maximum: number | null = null
  for (const collection of collections) {
    const found = await payload.find({ collection: collection as CollectionSlug, where: { sourceSystem: { equals: sourceSystem } }, sort: '-sourceSequence', limit: 1, depth: 0, draft: true, overrideAccess: false, user })
    const value = Number((found.docs[0] as Record<string, unknown> | undefined)?.sourceSequence)
    if (Number.isFinite(value) && (maximum === null || value > maximum)) maximum = value
  }
  return maximum
}
