import type { CollectionConfig, Field } from 'payload'
import { isStaff } from '../auth/access'

const text = (name: string): Field => ({ name, type: 'text', required: true })
const number = (name: string): Field => ({ name, type: 'number', required: true })
const relation = (name: string, relationTo: string): Field => ({ name, type: 'relationship', relationTo, required: true })
function privateCollection(slug: string, fields: Field[]): CollectionConfig {
  return {
    slug, timestamps: false, lockDocuments: false,
    admin: { useAsTitle: 'id', description: 'Review commands own these records. Use /api/review for mutations.' },
    access: { read: ({ req }) => isStaff(req.user), create: () => false, update: () => false, delete: () => false },
    fields: [text('id'), ...fields],
  }
}
export const reviewCollections: CollectionConfig[] = [
  privateCollection('video-revisions', [relation('video', 'videos'), relation('media', 'media'), relation('deliverableMedia', 'media'), text('deliverableChecksum'), text('checksum'), number('durationMs'), number('reviewVersion'), text('state'), { name: 'metadata', type: 'json', required: true }, relation('createdBy', 'users'), { name: 'createdAt', type: 'date', required: true }]),
  privateCollection('video-review-grants', [relation('video', 'videos'), relation('user', 'users'), number('version'), { name: 'canApprove', type: 'checkbox' }, { name: 'active', type: 'checkbox' }]),
  privateCollection('review-comments', [relation('video', 'videos'), relation('revision', 'video-revisions'), relation('author', 'users'), number('startMs'), { name: 'endMs', type: 'number' }, text('body'), { name: 'resolved', type: 'checkbox' }, { name: 'resolvedBy', type: 'relationship', relationTo: 'users' }, { name: 'resolvedAt', type: 'date' }, { name: 'createdAt', type: 'date', required: true }]),
  privateCollection('review-decisions', [relation('video', 'videos'), relation('revision', 'video-revisions'), relation('author', 'users'), number('reviewVersion'), number('grantVersion'), text('decision'), { name: 'note', type: 'textarea' }, { name: 'createdAt', type: 'date', required: true }]),
  {
    slug: 'video-publications', timestamps: false, lockDocuments: false,
    admin: { useAsTitle: 'id' },
    access: { read: () => true, create: () => false, update: () => false, delete: () => false },
    // Only the approved public projection lives here. No source keys, grants, comments or decisions.
    fields: [{ name: 'id', type: 'number', required: true }, { name: 'document', type: 'json', required: true }],
  },
]
