import type { ShowEndpointModule, ShowPageContext } from "@/lib/shows/types";
import { loadLiveMatch, loadSchedule } from "./queries";

interface BracketsWriteBinding {
	selfRegisterCompetitor(input: {
		bracketId: string;
		displayName: string;
		userId: string;
	}): Promise<{ competitorId: string; seasonId: string; bracketKind: string }>;
}

function escapeICS(value: string): string {
	return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

function toICSDate(iso: string): string {
	return `${new Date(iso)
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "")}`;
}

export function bracketEndpoints(showId: string): ShowEndpointModule[] {
	return [
		{
			slug: "apply",
			handler: async (ctx: ShowPageContext) => {
				if (ctx.request.method !== "POST") {
					return new Response("Method not allowed", { status: 405 });
				}
				const write = ctx.env.BRACKETS_WRITE as
					| BracketsWriteBinding
					| undefined;
				if (!write) {
					return new Response("registration unavailable", { status: 503 });
				}
				const user = ctx.locals.user;
				if (!user) {
					const returnTo = `/shows/${showId}/apply`;
					return new Response(null, {
						status: 303,
						headers: {
							Location: `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
						},
					});
				}

				const form = await ctx.request.formData();
				const bracketId = String(form.get("bracketId") ?? "").trim();
				const displayName =
					user.name?.trim() || user.email?.split("@")[0]?.trim() || user.id;

				if (!bracketId) {
					return new Response("bracketId required", {
						status: 400,
					});
				}

				try {
					await write.selfRegisterCompetitor({
						bracketId,
						displayName,
						userId: user.id,
					});
				} catch {
					return new Response("could not submit application", { status: 400 });
				}

				return new Response(null, {
					status: 303,
					headers: { Location: `/shows/${showId}/apply?submitted=1` },
				});
			},
		},
		{
			slug: "live",
			handler: async (ctx: ShowPageContext) => {
				const match = await loadLiveMatch(ctx.showId);
				return Response.json(
					{ live: match },
					{
						headers: {
							"Cache-Control": "public, max-age=15, s-maxage=15",
						},
					},
				);
			},
		},
		{
			slug: "schedule.ics",
			handler: async (ctx: ShowPageContext) => {
				const matches = (await loadSchedule(ctx.showId)).filter(
					(m) => m.scheduledAt && m.status !== "cancelled",
				);
				const lines = [
					"BEGIN:VCALENDAR",
					"VERSION:2.0",
					`PRODID:-//Rawkode Academy//${showId}//EN`,
					"CALSCALE:GREGORIAN",
				];
				for (const m of matches) {
					const title = `${m.sideA?.displayName ?? "TBD"} vs ${m.sideB?.displayName ?? "TBD"}`;
					const start = toICSDate(m.scheduledAt as string);
					lines.push(
						"BEGIN:VEVENT",
						`UID:${m.id}@${showId}.rawkode.academy`,
						`DTSTAMP:${toICSDate(new Date().toISOString())}`,
						`DTSTART:${start}`,
						`SUMMARY:${escapeICS(title)}`,
						m.scenarioTitle
							? `DESCRIPTION:${escapeICS(m.scenarioTitle)}`
							: "DESCRIPTION:",
						"END:VEVENT",
					);
				}
				lines.push("END:VCALENDAR");
				return new Response(lines.join("\r\n"), {
					headers: {
						"Content-Type": "text/calendar; charset=utf-8",
						"Content-Disposition": `attachment; filename="${showId}-schedule.ics"`,
					},
				});
			},
		},
	];
}
