import { z } from 'zod'

const positiveId = z.number().int().positive()
const commandId = z.string().uuid()
const iso = z.iso.datetime({ offset: true })
export const legacyIdPattern = /^[A-Za-z0-9._-]{1,200}$/
// Studio addresses a video by its content ID (the Payload legacyId); staff tools
// may send the numeric videoId instead. Exactly one is required.
const target = { legacyId: z.string().regex(legacyIdPattern).optional(), videoId: positiveId.optional() }
const broadcast = { ...target, commandId, at: iso }
export const editorialCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), videoId: positiveId, commandId, expectedVersion: z.number().int().nonnegative(), scheduledStartAt: iso.nullable() }).strict(),
  z.object({ action: z.literal('broadcast-started'), ...broadcast }).strict(),
  z.object({ action: z.literal('broadcast-ended'), ...broadcast }).strict(),
  z.object({
    action: z.literal('correct'), videoId: positiveId, commandId, expectedVersion: z.number().int().nonnegative(),
    fields: z.object({ scheduledStartAt: iso.nullable().optional(), broadcastStartedAt: iso.nullable().optional(), broadcastEndedAt: iso.nullable().optional() }).strict()
      .refine(fields => Object.keys(fields).length > 0, 'Correct at least one time'),
    note: z.string().trim().min(1).max(2000),
  }).strict(),
]).refine(command => (command.action !== 'broadcast-started' && command.action !== 'broadcast-ended') || (command.legacyId === undefined) !== (command.videoId === undefined), 'Send exactly one of legacyId or videoId')
export type EditorialCommand = z.infer<typeof editorialCommandSchema>
export const machineActions = ['broadcast-started', 'broadcast-ended'] as const
// A staff user from a Payload session, or the Studio machine principal verified by
// src/machine-auth.ts. Customers are refused by EditorialTimes.
export type EditorialActor = { kind: 'user'; id: number; role: 'staff' | 'customer' } | { kind: 'machine'; name: 'studio' }
export const actorName = (actor: EditorialActor) => actor.kind === 'user' ? `user:${actor.id}` : `machine:${actor.name}`
