import {isStaff} from './auth/access'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import type { Access, GlobalConfig } from 'payload'

const staff: Access = ({ req }) => isStaff(req.user)
export const mcpCatalogueSlugs = [
  'videos', 'articles', 'courses', 'course-modules', 'learning-paths',
  'shows', 'episodes', 'technologies', 'people', 'chapters', 'learning-resources',
] as const

// Experimental local staff configuration, not an Academy identity integration.
export const academyMcpGlobal: GlobalConfig = {
  slug: 'academy-settings',
  access: { read: staff, update: staff },
  fields: [{ name: 'editorialNote', type: 'text', defaultValue: 'Experimental local catalogue' }],
}

export const academyMcpPlugin = mcpPlugin({
  userCollection: 'users',
  collections: Object.fromEntries(mcpCatalogueSlugs.map(slug => [slug, {
    description: `Experimental Academy ${slug}. Preserve legacy IDs and import provenance.`,
    enabled: { find: true, create: true, update: true, delete: false },
  }])),
  globals: { 'academy-settings': { enabled: { find: true, update: true } } },
  mcp: {
    serverOptions: {
      serverInfo: { name: 'Academy experimental Payload MCP', version: '0.0.0' },
      instructions: 'Local experiment only. Preserve import provenance. Save drafts explicitly. Delete, identity, media upload, config and schema mutation tools are unavailable.',
    },
    handlerOptions: {
      disableSse: true,
      verboseLogs: false,
      // Never log raw event payloads: these can include arguments or content.
      // This is diagnostic telemetry, not a durable security audit log.
      onEvent: event => {
        const type = event && typeof event === 'object' && 'type' in event ? String(event.type) : 'unknown'
        console.info(JSON.stringify({ component: 'mcp', eventType: type }))
      },
    },
    tools: [{
      name: 'academyImportStatus',
      description: 'Count edited videos requiring import conflict review; returns no media or credentials.',
      parameters: {},
      handler: async (_args, req) => {
        const result = await req.payload.find({
          collection: 'videos', where: { locallyEdited: { equals: true } },
          limit: 1, depth: 0, draft: true, req, user: req.user, overrideAccess: false,
          select: { legacyId: true },
        })
        return { content: [{ type: 'text', text: JSON.stringify({ locallyEditedVideos: result.totalDocs, policy: 'Re-import must report conflicts; never silently overwrite local edits.' }) }] }
      },
    }],
    resources: [{
      name: 'academyCompatibilityPolicy', title: 'Academy compatibility and import policy',
      description: 'Boundaries of this local compatibility experiment.',
      uri: 'academy://compatibility/policy', mimeType: 'text/plain',
      handler: uri => ({ contents: [{ uri: uri.href, text: 'Public compatibility GraphQL stays query-only. Internal Payload and MCP write drafts and publish explicitly. Legacy identifiers are distinct from database IDs. Imported provenance is immutable through editorial writes. Re-import reports edited records as conflicts. No production publication, customer identity or private playback is implemented.' }] }),
    }],
  },
})
