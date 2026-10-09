import type { CollectionConfig, Field } from 'payload'
import { isStaff } from '../auth/access'
import type { AdminAccess } from '../admin/access'
import { applyPreset } from '../admin/collection-admin'
import { relationTitle } from '../admin/fields'

const text = (name: string): Field => ({ name, type: 'text', required: true })
const number = (name: string): Field => ({ name, type: 'number', required: true })
const relation = (name: string, relationTo: string): Field => ({ name, type: 'relationship', relationTo, required: true })
// Audit tables carry a videoTitle virtual (read through the video
// relationship) so lists and pickers show a name instead of a UUID.
const videoTitle = relationTitle('videoTitle', 'video.title', 'Video')
function privateCollection(slug: string, fields: Field[], access: AdminAccess, titled = true): CollectionConfig {
  return applyPreset({
    slug, timestamps: false, lockDocuments: false,
    access: { read: ({ req }) => isStaff(req.user), create: () => false, update: () => false, delete: () => false },
    fields: [...(titled ? [videoTitle] : []), text('id'), ...fields],
  }, access)
}
export const reviewCollections = (access: AdminAccess): CollectionConfig[] => [
  privateCollection('video-revisions', [relation('video', 'videos'), relation('media', 'media'), relation('deliverableMedia', 'media'), text('deliverableChecksum'), text('checksum'), number('durationMs'), number('reviewVersion'), text('state'), { name: 'metadata', type: 'json', required: true }, relation('createdBy', 'users'), { name: 'createdAt', type: 'date', required: true }], access),
  privateCollection('video-review-grants', [relation('video', 'videos'), relation('user', 'users'), number('version'), { name: 'canApprove', type: 'checkbox' }, { name: 'active', type: 'checkbox' }], access, false),
  privateCollection('review-comments', [relation('video', 'videos'), relation('revision', 'video-revisions'), relation('author', 'users'), number('startMs'), { name: 'endMs', type: 'number' }, text('body'), { name: 'resolved', type: 'checkbox' }, { name: 'resolvedBy', type: 'relationship', relationTo: 'users' }, { name: 'resolvedAt', type: 'date' }, { name: 'createdAt', type: 'date', required: true }], access),
  privateCollection('review-decisions', [relation('video', 'videos'), relation('revision', 'video-revisions'), relation('author', 'users'), number('reviewVersion'), number('grantVersion'), text('decision'), { name: 'note', type: 'textarea' }, { name: 'createdAt', type: 'date', required: true }], access),
  applyPreset({
    slug: 'video-publications', timestamps: false, lockDocuments: false,
    access: { read: () => true, create: () => false, update: () => false, delete: () => false },
    // Only the approved public projection lives here. No source keys, grants, comments or decisions.
    fields: [{ name: 'id', type: 'number', required: true }, { name: 'document', type: 'json', required: true }],
  }, access),
]
