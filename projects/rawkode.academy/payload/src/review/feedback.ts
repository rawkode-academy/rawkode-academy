import { isCuid2 } from '../cuid2'
import { ReviewError, type ReviewActor } from './contracts'
import type { ReviewService } from './service'

export type FeedbackRow = { id: string; start_ms: number; end_ms: number | null; body: string; resolved: number; resolved_at: string | null; created_at: string; role: string; author: string }
const header = ['comment_id', 'revision_id', 'start_timecode', 'end_timecode', 'start_ms', 'end_ms', 'author', 'author_role', 'created_at', 'resolved', 'resolved_at', 'body']
function timecode(ms: number | null) {
  if (ms === null) return ''
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`
}
// Spreadsheets evaluate cells that start with these characters as formulas.
const text = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
const cell = (value: string) => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

// RFC 4180 with CRLF line endings and a UTF-8 BOM so spreadsheet apps detect the encoding.
export function feedbackCsv(rows: FeedbackRow[], revisionId: string): string {
  const lines = [header, ...rows.map(row => [row.id, revisionId, timecode(row.start_ms), timecode(row.end_ms), String(row.start_ms), row.end_ms === null ? '' : String(row.end_ms),
    text(row.author), row.role, row.created_at, row.resolved ? 'true' : 'false', row.resolved_at ?? '', text(row.body)])]
  return '\uFEFF' + lines.map(line => line.map(cell).join(',') + '\r\n').join('')
}
export function feedbackHeaders(filename: string) {
  return { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' }
}
export async function feedbackExport(service: ReviewService, actor: ReviewActor, videoId: string, revisionId: string): Promise<{ filename: string; csv: string }> {
  if (!isCuid2(revisionId)) throw new ReviewError(400, 'A revisionId is required')
  await service.access.require(actor, videoId, revisionId, 'export')
  const filter = service.access.commentFilter(actor)
  // Never select an email column: the export may leave the review surface.
  const rows = await service.store.all<FeedbackRow>(`SELECT c.id,c.start_ms,c.end_ms,c.body,c.resolved,c.resolved_at,c.created_at,u.role,COALESCE(u.name,'') AS author
    FROM review_comments c JOIN users u ON u.id=c.author_id
    WHERE c.video_id=? AND c.revision_id=?${filter.sql}
    ORDER BY c.start_ms,c.created_at,c.id`, videoId, revisionId, ...filter.values)
  return { filename: `review-${videoId}-${revisionId}-feedback.csv`, csv: feedbackCsv(rows, revisionId) }
}
