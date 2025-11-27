/**
 * Re-export auth types for backward compatibility
 */
export type { User as BetterAuthUser, Session as BetterAuthSession } from "./server";
export { getSignInUrl, getSignOutUrl, getSession, signOut } from "./server";
