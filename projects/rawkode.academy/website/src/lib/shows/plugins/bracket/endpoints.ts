import type { ShowEndpointModule, ShowPageContext } from "@/lib/shows/types";
import { loadLiveMatch, loadSchedule } from "./queries";

// The write-model RPC surface this plugin needs. Bound on the website worker
// as BRACKETS_WRITE -> platform-brackets-write-model.
interface BracketsWriteBinding {
	submitRegistration(input: {
		showId: string;
		bracketId: string;
		displayName: string;
		email: string;
		teamName?: string | null;
		preferredSlot?: number | null;
		message?: string | null;
		userId?: string | null;
	}): Promise<{ id: string }>;
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

				const form = await ctx.request.formData();
				const bracketId = String(form.get("bracketId") ?? "").trim();
				const displayName = String(form.get("displayName") ?? "").trim();
				const email = String(form.get("email") ?? "").trim();
				const teamName = String(form.get("teamName") ?? "").trim() || null;
				const message = String(form.get("message") ?? "").trim() || null;
				const slotRaw = String(form.get("preferredSlot") ?? "").trim();
				const preferredSlot = slotRaw ? Number.parseInt(slotRaw, 10) : null;

				if (!bracketId || !displayName || !email) {
					return new Response("bracketId, displayName, email required", {
						status: 400,
					});
				}

				try {
					await write.submitRegistration({
						showId,
						bracketId,
						displayName,
						email,
						teamName,
						preferredSlot: Number.isFinite(preferredSlot)
							? preferredSlot
							: null,
						message,
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
