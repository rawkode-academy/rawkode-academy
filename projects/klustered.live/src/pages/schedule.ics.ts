import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { asc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/db/client";

export const prerender = false;

const SITE_URL = "https://klustered.live";

function pad(n: number): string {
	return n.toString().padStart(2, "0");
}

function formatIcsDate(value: Date): string {
	return (
		value.getUTCFullYear().toString() +
		pad(value.getUTCMonth() + 1) +
		pad(value.getUTCDate()) +
		"T" +
		pad(value.getUTCHours()) +
		pad(value.getUTCMinutes()) +
		pad(value.getUTCSeconds()) +
		"Z"
	);
}

function escapeIcs(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;");
}

export const GET: APIRoute = async () => {
	const db = getDb(env.DB);
	const teamA = alias(schema.teams, "team_a");
	const teamB = alias(schema.teams, "team_b");

	const rows = await db
		.select({
			id: schema.matches.id,
			scheduledAt: schema.matches.scheduledAt,
			status: schema.matches.status,
			roundNumber: schema.matches.roundNumber,
			seasonName: schema.seasons.name,
			bracketName: schema.brackets.name,
			teamAName: teamA.name,
			teamBName: teamB.name,
		})
		.from(schema.matches)
		.leftJoin(schema.brackets, eq(schema.matches.bracketId, schema.brackets.id))
		.leftJoin(schema.seasons, eq(schema.brackets.seasonId, schema.seasons.id))
		.leftJoin(teamA, eq(schema.matches.teamAId, teamA.id))
		.leftJoin(teamB, eq(schema.matches.teamBId, teamB.id))
		.where(isNotNull(schema.matches.scheduledAt))
		.orderBy(asc(schema.matches.scheduledAt))
		.all();

	const now = new Date();
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Rawkode Academy//Klustered//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Klustered",
		"X-WR-TIMEZONE:UTC",
	];

	for (const m of rows) {
		if (!m.scheduledAt) continue;
		const start = new Date(m.scheduledAt);
		const end = new Date(start.getTime() + 60 * 60 * 1000);
		const summary = `${m.teamAName ?? "TBD"} vs ${m.teamBName ?? "TBD"}`;
		const description = `${m.seasonName ?? ""} · ${m.bracketName ?? ""} · Round ${m.roundNumber}`;
		lines.push(
			"BEGIN:VEVENT",
			`UID:${m.id}@klustered.live`,
			`DTSTAMP:${formatIcsDate(now)}`,
			`DTSTART:${formatIcsDate(start)}`,
			`DTEND:${formatIcsDate(end)}`,
			`SUMMARY:${escapeIcs(summary)}`,
			`DESCRIPTION:${escapeIcs(description)}`,
			`URL:${SITE_URL}/schedule`,
			"END:VEVENT",
		);
	}

	lines.push("END:VCALENDAR");

	return new Response(lines.join("\r\n"), {
		status: 200,
		headers: {
			"content-type": "text/calendar; charset=utf-8",
			"content-disposition": 'inline; filename="klustered.ics"',
			"cache-control": "public, max-age=300",
		},
	});
};
