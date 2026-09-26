import type { Principal, Role } from "../domain/protocol";
import type { Env } from "../env";

type IdentitySession = { user?: { id?: unknown } };
type Operator = { id: string; role: string; display_name: string };

function sessionToken(header: string | null): string | undefined {
	return (header ?? "").split(";").map((cookie) => cookie.trim()).find((cookie) =>
		cookie.startsWith("better-auth.session_token=") ||
		cookie.startsWith("__Secure-better-auth.session_token="),
	);
}

/** Resolve only the provider's server-side session token, bypassing its cookie cache. */
export async function authenticateOperator(request: Request, env: Env): Promise<Principal | undefined> {
	const cookie = sessionToken(request.headers.get("cookie"));
	if (!cookie || !env.IDENTITY) return undefined;
	try {
		const response = await env.IDENTITY.fetch("https://id.rawkode.academy/auth/get-session?disableCookieCache=true", {
			headers: { Cookie: cookie, Origin: "https://play.rawkode.academy" },
		});
		if (!response.ok) return undefined;
		const session = await response.json<IdentitySession | null>();
		const userId = session?.user?.id;
		if (typeof userId !== "string" || !userId) return undefined;
		const operator = await env.DB.prepare("SELECT id, role, display_name FROM arcade_operators WHERE identity_subject = ? AND active = 1 LIMIT 1")
			.bind(`academy:${userId}`).first<Operator>();
		if (!operator) return undefined;
		const role: Role = operator.role === "operator" ? "producer" : operator.role as Role;
		if (role !== "host" && role !== "producer" && role !== "moderator") return undefined;
		return { id: operator.id, role, displayName: operator.display_name };
	} catch {
		return undefined;
	}
}
