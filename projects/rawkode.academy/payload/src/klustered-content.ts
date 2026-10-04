import { createHash } from 'node:crypto'
import type { CatalogueRecord, CatalogueSnapshot, Reference } from './importer'

export type KlusteredTable = 'seasons' | 'competitors' | 'brackets' | 'bracket_applications' | 'teams' | 'team_members' | 'team_invites' | 'bracket_breaks' | 'bracket_entries' | 'matches' | 'match_results' | 'registrations'
export type KlusteredRows = Partial<Record<KlusteredTable, Record<string, unknown>[]>>

const tableAliases: Record<KlusteredTable, string[]> = {
  seasons: ['seasons'], competitors: ['competitors'], brackets: ['brackets'], bracket_applications: ['bracket_applications', 'bracketApplications'],
  teams: ['teams'], team_members: ['team_members', 'teamMembers'], team_invites: ['team_invites', 'teamInvites'], bracket_breaks: ['bracket_breaks', 'bracketBreaks'],
  bracket_entries: ['bracket_entries', 'bracketEntries'], matches: ['matches'], match_results: ['match_results', 'matchResults'], registrations: ['registrations'],
}
const collectionFor: Record<KlusteredTable, CatalogueRecord['collection']> = {
  seasons: 'seasons', competitors: 'competitors', brackets: 'brackets', bracket_applications: 'bracket-applications', teams: 'teams', team_members: 'team-members',
  team_invites: 'team-invites', bracket_breaks: 'bracket-breaks', bracket_entries: 'bracket-entries', matches: 'matches', match_results: 'match-results', registrations: 'registrations',
}
const legacyTypeFor: Record<KlusteredTable, string> = {
  seasons: 'Season', competitors: 'Competitor', brackets: 'Bracket', bracket_applications: 'BracketApplication', teams: 'Team', team_members: 'TeamMember',
  team_invites: 'TeamInvite', bracket_breaks: 'BracketBreak', bracket_entries: 'BracketEntry', matches: 'Match', match_results: 'MatchResult', registrations: 'Registration',
}
const dateFields = new Set(['startDate', 'endDate', 'startsAt', 'endsAt', 'registrationClosesAt', 'createdAt', 'updatedAt', 'reviewedAt', 'revokedAt', 'scheduledAt', 'startedAt', 'endedAt', 'recordedAt', 'submittedAt'])
const sourceIdentifierFields = new Set(['showId', 'seasonId', 'bracketId', 'competitorId', 'teamId', 'teamAId', 'teamBId', 'entryAId', 'entryBId', 'winnerTeamId', 'winnerEntryId', 'matchId'])

function sourceFieldName(name: string): string {
  return sourceIdentifierFields.has(name) ? `source${name[0].toUpperCase()}${name.slice(1)}` : name
}

function rowValue(row: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key]
  const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  return Object.prototype.hasOwnProperty.call(row, snakeKey) ? row[snakeKey] : undefined
}

function isoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const date = typeof value === 'number' || /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function sourceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sourceValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceValue(child)]))
  return value
}

function id(row: Record<string, unknown>, field = 'id'): string {
  const value = rowValue(row, field)
  if (value === null || value === undefined || value === '') throw new Error(`Klustered ${field} is missing`)
  return String(value)
}

function sensitiveLegacyId(value: string): string {
  return `invite-${createHash('sha256').update(`team-invite:${value}`).digest('hex')}`
}

function ref(collection: Reference['collection'], value: unknown): Reference | null {
  return value === null || value === undefined || value === '' ? null : { collection, legacyId: String(value) }
}

function fields(row: Record<string, unknown>, names: string[]): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const name of names) {
    const value = rowValue(row, name)
    if (value === undefined) continue
    output[sourceFieldName(name)] = value === null ? null : dateFields.has(name) ? isoDate(value) : value
  }
  return output
}

function sourceFor(table: KlusteredTable, row: Record<string, unknown>, sourceId: string): { path: string; format: 'json'; data: Record<string, unknown>; raw: string } {
  const data = sourceValue(row) as Record<string, unknown>
  return { path: `platform-brackets/${table}/${sourceId}`, format: 'json', data, raw: JSON.stringify(data) }
}

function recordFor(table: KlusteredTable, row: Record<string, unknown>): CatalogueRecord {
  const seasonId = rowValue(row, 'seasonId')
  const bracketId = rowValue(row, 'bracketId')
  const teamId = rowValue(row, 'teamId')
  const competitorId = rowValue(row, 'competitorId')
  const entryId = table === 'team_members'
    ? `${id(row, 'teamId')}:${id(row, 'competitorId')}`
    : table === 'team_invites'
      ? id(row, 'token')
      : id(row)
  let legacyId = table === 'team_invites' ? sensitiveLegacyId(entryId) : entryId
  let slug = entryId
  if (table === 'team_invites') slug = legacyId
  if (table === 'team_members') {
    legacyId = entryId
    slug = legacyId
  } else if (table === 'seasons' || table === 'brackets' || table === 'teams') {
    slug = String(rowValue(row, 'slug') ?? entryId)
  } else if (table === 'competitors') {
    legacyId = entryId
    slug = `${seasonId}:${rowValue(row, 'personSlug') ?? entryId}`
  }
  const collection = collectionFor[table]
  const data = fields(row, {
    seasons: ['showId', 'name', 'status', 'startDate', 'endDate', 'createdAt', 'updatedAt'],
    competitors: ['seasonId', 'personSlug', 'displayName', 'bio', 'userId', 'createdAt', 'updatedAt'],
    brackets: ['seasonId', 'name', 'kind', 'format', 'status', 'startsAt', 'registrationClosesAt', 'maxEntries', 'teamSize', 'cadenceDays', 'createdAt', 'updatedAt'],
    bracket_applications: ['bracketId', 'competitorId', 'status', 'createdAt', 'reviewedAt', 'reviewedByUserId'],
    teams: ['seasonId', 'bracketId', 'name', 'createdAt', 'updatedAt'],
    team_members: ['teamId', 'bracketId', 'competitorId', 'role', 'createdAt'],
    team_invites: ['token', 'teamId', 'bracketId', 'createdByUserId', 'createdAt', 'revokedAt'],
    bracket_breaks: ['bracketId', 'label', 'startsAt', 'endsAt', 'createdAt'],
    bracket_entries: ['bracketId', 'competitorId', 'teamId', 'displayName', 'seed', 'status', 'createdAt', 'updatedAt'],
    matches: ['bracketId', 'roundNumber', 'positionInRound', 'scheduledAt', 'status', 'teamAId', 'teamBId', 'entryAId', 'entryBId', 'judgeUserId', 'winnerTeamId', 'winnerEntryId', 'startedAt', 'endedAt', 'createdAt', 'updatedAt'],
    match_results: ['matchId', 'winnerTeamId', 'winnerEntryId', 'timeToResolveSeconds', 'scoreA', 'scoreB', 'notes', 'recordedAt', 'recordedByUserId'],
    registrations: ['seasonId', 'bracketId', 'entryType', 'teamName', 'preferredSlot', 'userId', 'displayName', 'email', 'message', 'status', 'submittedAt', 'reviewedAt', 'reviewedByUserId'],
  }[table])
  const relationships: Record<string, Reference | null> = {}
  if (table === 'seasons') relationships.show = ref('shows', rowValue(row, 'showId'))
  if (table === 'competitors') relationships.season = ref('seasons', seasonId)
  if (table === 'brackets') relationships.season = ref('seasons', seasonId)
  if (table === 'bracket_applications') { relationships.bracket = ref('brackets', bracketId); relationships.competitor = ref('competitors', competitorId) }
  if (table === 'teams') { relationships.season = ref('seasons', seasonId); relationships.bracket = ref('brackets', bracketId) }
  if (table === 'team_members') { relationships.team = ref('teams', teamId); relationships.bracket = ref('brackets', bracketId); relationships.competitor = ref('competitors', competitorId) }
  if (table === 'team_invites') { relationships.team = ref('teams', teamId); relationships.bracket = ref('brackets', bracketId) }
  if (table === 'bracket_breaks') relationships.bracket = ref('brackets', bracketId)
  if (table === 'bracket_entries') { relationships.bracket = ref('brackets', bracketId); relationships.competitor = ref('competitors', competitorId); relationships.team = ref('teams', teamId) }
  if (table === 'matches') {
    relationships.bracket = ref('brackets', bracketId); relationships.teamA = ref('teams', rowValue(row, 'teamAId')); relationships.teamB = ref('teams', rowValue(row, 'teamBId'))
    relationships.entryA = ref('bracket-entries', rowValue(row, 'entryAId')); relationships.entryB = ref('bracket-entries', rowValue(row, 'entryBId'))
    relationships.winnerTeam = ref('teams', rowValue(row, 'winnerTeamId')); relationships.winnerEntry = ref('bracket-entries', rowValue(row, 'winnerEntryId'))
  }
  if (table === 'match_results') {
    relationships.match = ref('matches', rowValue(row, 'matchId')); relationships.winnerTeam = ref('teams', rowValue(row, 'winnerTeamId')); relationships.winnerEntry = ref('bracket-entries', rowValue(row, 'winnerEntryId'))
  }
  if (table === 'registrations') { relationships.season = ref('seasons', seasonId); relationships.bracket = ref('brackets', bracketId) }
  const { createdAt, updatedAt, ...editable } = data
  return {
    collection, legacyId, legacyType: legacyTypeFor[table], slug, sourceRevision: createHash('sha256').update(JSON.stringify(sourceValue(row))).digest('hex'), status: 'published',
    data: { ...editable, sourceCreatedAt: createdAt, sourceUpdatedAt: updatedAt }, relationships, source: sourceFor(table, row, legacyId),
  }
}

export function buildKlusteredSnapshot(input: KlusteredRows, options: { sequence?: number; includeSensitive?: boolean } = {}): CatalogueSnapshot {
  const records: CatalogueRecord[] = []
  for (const table of Object.keys(tableAliases) as KlusteredTable[]) {
    if (!options.includeSensitive && (table === 'team_invites' || table === 'registrations')) continue
    const rows = tableAliases[table].map(alias => input[alias as KlusteredTable]).find(value => Array.isArray(value)) ?? []
    for (const row of rows) records.push(recordFor(table, row))
  }
  const configuredSequence = Number(process.env.KLUSTERED_CONTENT_SEQUENCE ?? 1)
  const sequence = options.sequence ?? (Number.isSafeInteger(configuredSequence) && configuredSequence > 0 ? configuredSequence : 1)
  return { sourceSystem: 'klustered-platform-brackets', mappingVersion: 'klustered-brackets-v1', sequence, records }
}

export const klusteredTables = Object.keys(tableAliases) as KlusteredTable[]
