import type { Context } from "hono";

// Token introspection response from Zitadel
export interface TokenInfo {
	active: boolean;
	scope?: string;
	client_id?: string;
	username?: string;
	exp?: number;
	iat?: number;
	sub?: string;
	aud?: string | string[];
	iss?: string;
	jti?: string;
	// Zitadel-specific claims
	"urn:zitadel:iam:org:id"?: string;
	"urn:zitadel:iam:user:id"?: string;
	"urn:zitadel:iam:user:resourceowner:id"?: string;
	"urn:zitadel:iam:user:resourceowner:name"?: string;
	[key: string]: unknown;
}

// Helper to get token info from context
export function getTokenInfoFromContext(
	c: Context<{ Bindings: Env }>,
): TokenInfo | null {
	return c.get("tokenInfo") as TokenInfo | null;
}
