/** The role carried by a short-lived route ticket, independent of browser cookies. */
export type ScopedViewRole = "host" | "producer" | "player" | "audience" | "display";

/**
 * Preserves an intentionally downscoped tab during state recovery and ticket
 * renewal. The server verifies the requested role against room membership.
 */
export function viewScopeHeaders(role?: ScopedViewRole): HeadersInit {
	return role ? { "x-arcade-view-role": role } : {};
}
