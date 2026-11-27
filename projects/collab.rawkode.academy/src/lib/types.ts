export type OrgRole = "owner" | "admin" | "moderator" | "contributor" | "member";

export interface Principal {
	userId: string;
	login: string;
	name: string;
	/** Rawkode staff who run the portal. */
	admin: boolean;
	orgs: { orgId: string; role: OrgRole }[];
}

export interface Session {
	principal: Principal;
	/** The OIDC access token the gateway validates for every call. */
	accessToken: string;
	/** Epoch ms; the sign-in is repeated after this. */
	expiresAt: number;
	/** Set only by an admin: see exactly what this organisation sees, read-only. */
	viewAs?: { orgId: string; kind: "partner" };
}
