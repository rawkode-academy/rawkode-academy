import {
	hasDirectorRole,
	type OidcStandardClaimsWithRoles,
} from "@/lib/auth/auth-types";

/**
 * Security utilities for API endpoints and route validation
 */

export interface SecurityContext {
	user: OidcStandardClaimsWithRoles | null;
	requiredLevel: AccessLevel;
	resource?: string;
	action?: string;
}

export enum AccessLevel {
	PUBLIC = "public",
	AUTHENTICATED = "authenticated",
	DIRECTOR = "director",
	ADMIN = "admin",
}

export interface AuditLogEntry {
	userId: string;
	action: string;
	resource?: string;
	success: boolean;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

/**
 * Validate user access for API endpoints
 */
export function validateAccess(context: SecurityContext): {
	hasAccess: boolean;
	userLevel: AccessLevel;
	reason?: string;
} {
	const { user, requiredLevel } = context;
	const userLevel = getUserAccessLevel(user);

	switch (requiredLevel) {
		case AccessLevel.PUBLIC:
			return { hasAccess: true, userLevel };

		case AccessLevel.AUTHENTICATED:
			if (!user) {
				return {
					hasAccess: false,
					userLevel,
					reason: "Authentication required",
				};
			}
			return { hasAccess: true, userLevel };

		case AccessLevel.DIRECTOR:
			if (!user) {
				return {
					hasAccess: false,
					userLevel,
					reason: "Authentication required",
				};
			}
			if (!hasDirectorRole(user)) {
				return {
					hasAccess: false,
					userLevel,
					reason: "Director role required",
				};
			}
			return { hasAccess: true, userLevel };

		case AccessLevel.ADMIN:
			// Future: implement admin role check
			if (!user) {
				return {
					hasAccess: false,
					userLevel,
					reason: "Authentication required",
				};
			}
			if (!hasDirectorRole(user)) {
				return {
					hasAccess: false,
					userLevel,
					reason: "Admin role required",
				};
			}
			return { hasAccess: true, userLevel };

		default:
			return {
				hasAccess: false,
				userLevel,
				reason: "Invalid access level",
			};
	}
}

/**
 * Get user's current access level
 */
export function getUserAccessLevel(
	user: OidcStandardClaimsWithRoles | null,
): AccessLevel {
	if (!user) return AccessLevel.PUBLIC;
	if (hasDirectorRole(user)) return AccessLevel.DIRECTOR;
	return AccessLevel.AUTHENTICATED;
}

/**
 * Create audit log entry for security events
 */
export function createAuditLog(
	entry: Omit<AuditLogEntry, "timestamp">,
): AuditLogEntry {
	return {
		...entry,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Log security event (in production, this would go to a logging service)
 */
export function logSecurityEvent(entry: AuditLogEntry): void {
	// For now, just console log. In production, send to security monitoring
	if (entry.success) {
		console.log("Security Event:", entry);
	} else {
		console.warn("Security Alert:", entry);
	}
}

/**
 * Validate meeting access permissions
 * Updated to allow anyone with a meeting link to join (like Zoom/Google Meet)
 */
export function validateMeetingAccess(
	user: OidcStandardClaimsWithRoles | null,
	meeting: { status?: string },
	action: "view" | "join" | "control" = "view",
): {
	canAccess: boolean;
	preset: "livestream_viewer" | "livestream_host";
	reason?: string;
} {
	// Determine preset based on user role
	const isDirector = user ? hasDirectorRole(user) : false;
	const preset = isDirector ? "livestream_host" : "livestream_viewer";

	switch (action) {
		case "view":
			// Anyone can view meeting details
			return {
				canAccess: true,
				preset,
			};

		case "join":
			// Anyone with the link can join, but only if meeting is active
			if (meeting.status === "INACTIVE") {
				return {
					canAccess: false,
					preset,
					reason: "Meeting is inactive",
				};
			}
			return {
				canAccess: true,
				preset,
			};

		case "control":
			// Only directors can control meetings
			if (!isDirector) {
				return {
					canAccess: false,
					preset: "livestream_viewer",
					reason: "Director role required for meeting control",
				};
			}
			return {
				canAccess: true,
				preset: "livestream_host",
			};

		default:
			return {
				canAccess: false,
				preset: "livestream_viewer",
				reason: "Invalid action",
			};
	}
}

/**
 * Generate secure participant ID
 */
export function generateParticipantId(
	user: OidcStandardClaimsWithRoles | null,
): string {
	if (user?.sub) {
		return `${user.sub}-${Date.now()}`;
	}
	// For anonymous users, use crypto.randomUUID
	const uuid = crypto.randomUUID();

	return `guest-${uuid}`;
}

/**
 * Sanitize user input for security
 */
export function sanitizeInput(input: string): string {
	if (!input || typeof input !== "string") return "";

	// Remove potentially dangerous characters
	return input
		.trim()
		.replace(/[<>'"&]/g, "") // Remove HTML/script injection chars
		.replace(/[^\w\s.-]/g, "") // Allow only word chars, spaces, dots, dashes
		.slice(0, 100); // Limit length
}

/**
 * Rate limiting for API endpoints (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
	identifier: string,
	maxRequests: number = 10,
	windowMs: number = 60000, // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const key = identifier;
	const window = rateLimitMap.get(key);

	if (!window || now > window.resetTime) {
		// Reset or create new window
		const resetTime = now + windowMs;
		rateLimitMap.set(key, { count: 1, resetTime });
		return { allowed: true, remaining: maxRequests - 1, resetTime };
	}

	if (window.count >= maxRequests) {
		return { allowed: false, remaining: 0, resetTime: window.resetTime };
	}

	window.count++;
	return {
		allowed: true,
		remaining: maxRequests - window.count,
		resetTime: window.resetTime,
	};
}
