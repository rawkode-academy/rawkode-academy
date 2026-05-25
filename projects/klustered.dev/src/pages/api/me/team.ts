import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const user = locals.user;
	if (!user) return new Response("Unauthorized", { status: 401 });

	const form = await request.formData();
	const value = (name: string) => String(form.get(name) ?? "").trim();
	const action = value("action");
	const write = bracketsWrite(env);

	try {
		switch (action) {
			case "create": {
				const bracketId = value("bracketId");
				const name = value("name");
				if (!bracketId || !name) {
					return new Response("bracketId and name required", { status: 400 });
				}
				await write.formTeam({ bracketId, name, userId: user.id });
				break;
			}
			case "rename": {
				const teamId = value("teamId");
				const name = value("name");
				if (!teamId || !name) {
					return new Response("teamId and name required", { status: 400 });
				}
				await write.renameTeam({ teamId, name, userId: user.id });
				break;
			}
			case "invite": {
				const teamId = value("teamId");
				if (!teamId) return new Response("teamId required", { status: 400 });
				await write.createTeamInvite({ teamId, userId: user.id });
				break;
			}
			case "revoke": {
				const token = value("token");
				if (!token) return new Response("token required", { status: 400 });
				await write.revokeTeamInvite({ token, userId: user.id });
				break;
			}
			case "leave": {
				const teamId = value("teamId");
				if (!teamId) return new Response("teamId required", { status: 400 });
				await write.leaveTeam({ teamId, userId: user.id });
				break;
			}
			default:
				return new Response("invalid action", { status: 400 });
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "team update failed";
		return new Response(message, { status: 400 });
	}

	return redirect("/me/team", 303);
};
