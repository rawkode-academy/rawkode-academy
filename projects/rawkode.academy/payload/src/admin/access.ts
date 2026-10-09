import { isStaff } from '../auth/access'

// Admin-only visibility. This is the single auth-adjacent helper for the admin
// experience: it reads the user's existing role and oidcSubject and never
// grants data access. Collection access control stays in src/auth.
export type AdminAccess = { developerSubjects: readonly string[]; localAuth: boolean }

export const noDevelopers: AdminAccess = { developerSubjects: [], localAuth: false }

// Same strict format as OIDC_STAFF_SUBJECTS: an explicit JSON array of
// non-empty subject strings. Fails closed: malformed input throws, and every
// developer must already be a staff subject.
export function parseDeveloperSubjects(raw: string | undefined, staffSubjects: readonly string[]): string[] {
	let subjects: unknown
	try {
		subjects = JSON.parse(raw ?? '[]')
	} catch {
		throw new Error('DEVELOPER_SUBJECTS must be an explicit JSON array of subjects')
	}
	if (!Array.isArray(subjects) || subjects.some(subject => typeof subject !== 'string' || !subject)) {
		throw new Error('DEVELOPER_SUBJECTS must be an explicit JSON array of subjects')
	}
	const unknown = subjects.filter(subject => !staffSubjects.includes(subject))
	if (unknown.length) throw new Error('Every DEVELOPER_SUBJECTS entry must also be listed in OIDC_STAFF_SUBJECTS')
	return subjects as string[]
}

export function isDeveloper(access: AdminAccess, user: unknown): boolean {
	if (!isStaff(user)) return false
	const subject = (user as { oidcSubject?: unknown }).oidcSubject
	if (typeof subject === 'string' && subject) return access.developerSubjects.includes(subject)
	// Loopback-only local staff accounts have no OIDC subject. They exist only
	// when POC_DEV_LOCAL_AUTH is on, which authConfig forbids off loopback.
	return access.localAuth
}

export const hiddenUnlessDeveloper =
	(access: AdminAccess) =>
	({ user }: { user: unknown }): boolean =>
		!isDeveloper(access, user)

// Server components read the configured access from payload.config.custom,
// which never reaches the client.
export function adminAccessOf(payload: { config: { custom?: Record<string, unknown> } }): AdminAccess {
	const value = payload.config.custom?.adminAccess as AdminAccess | undefined
	return value ?? noDevelopers
}
