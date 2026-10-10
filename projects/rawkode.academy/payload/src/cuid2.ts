import { createId } from '@paralleldrive/cuid2'

/**
 * Use the canonical CUID2 implementation and its default 24-character length.
 */
export function createCuid2(): string {
  return createId()
}

export function isCuid2(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9]{23}$/.test(value)
}
