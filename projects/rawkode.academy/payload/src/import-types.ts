export type ContentCollection =
  | 'videos' | 'articles' | 'courses' | 'course-modules' | 'learning-paths' | 'shows' | 'episodes'
  | 'technologies' | 'people' | 'chapters' | 'learning-resources' | 'series' | 'adrs' | 'testimonials'
  | 'news' | 'changelog' | 'static-assets' | 'seasons' | 'competitors' | 'brackets' | 'bracket-applications'
  | 'teams' | 'team-members' | 'team-invites' | 'bracket-breaks' | 'bracket-entries' | 'matches'
  | 'match-results' | 'registrations'

export type ContentReference = { collection: ContentCollection; legacyId: string }
export type SourceAsset = { relativePath: string; r2Key: string; mimeType: string; bytes: number; checksum: string }
export type SourceMetadata = { path: string; assets?: SourceAsset[] }
export type ImportRecord = {
  collection: ContentCollection
  legacyId: string
  slug: string
  sourceRevision: string
  status?: 'draft' | 'published'
  tombstone?: boolean
  data: Record<string, unknown>
  relationships?: Record<string, ContentReference | ContentReference[] | null>
  source?: SourceMetadata
}
export type ImportSnapshot = {
  sourceSystem: string
  mappingVersion: string
  sequence: number
  records: ImportRecord[]
}
