import { createId } from "@paralleldrive/cuid2";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
	Bracket,
	Competitor,
	NewBracket,
	NewCompetitor,
	NewMatch,
} from "../src/db/schema.ts";
import { generateSingleEliminationBracket } from "../src/lib/bracket-utils.ts";

const MOCK_COMPETITORS = [
	{ name: "kubectl-master", displayName: "Kubectl Master" },
	{ name: "helm-hero", displayName: "Helm Hero" },
	{ name: "argo-ace", displayName: "Argo Ace" },
	{ name: "flux-wizard", displayName: "Flux Wizard" },
	{ name: "crossplane-champion", displayName: "Crossplane Champion" },
	{ name: "kustomize-king", displayName: "Kustomize King" },
	{ name: "cilium-sage", displayName: "Cilium Sage" },
	{ name: "istio-ninja", displayName: "Istio Ninja" },
];

type Phase = "interest" | "active" | "finished";

function getLocalDbPath(): string {
	const dbPath = resolve(
		import.meta.dirname ?? ".",
		"../.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
	);

	if (!existsSync(dbPath)) {
		console.error(
			"Local D1 database not found. Run 'deno task db:migrate:local' first.",
		);
		Deno.exit(1);
	}

	const entries = [...Deno.readDirSync(dbPath)];
	const sqliteFile = entries.find((e) => e.name.endsWith(".sqlite"));

	if (!sqliteFile) {
		console.error(
			"No SQLite database file found. Run 'deno task db:migrate:local' first.",
		);
		Deno.exit(1);
	}

	return resolve(dbPath, sqliteFile.name);
}

function parseArgs(): { phase: Phase; force: boolean } {
	const args = Deno.args;
	let phase: Phase | null = null;
	let force = false;

	for (const arg of args) {
		if (arg === "--force" || arg === "-f") {
			force = true;
		} else if (arg === "interest" || arg === "active" || arg === "finished") {
			phase = arg;
		}
	}

	if (!phase) {
		console.log("Klustered.dev Database Seeder");
		console.log("=============================\n");
		console.log("Usage: deno task db:seed <phase> [--force]\n");
		console.log("Phases:");
		console.log("  interest  - Registration phase (accepting sign-ups)");
		console.log("  active    - Tournament in progress (matches being played)");
		console.log("  finished  - Completed tournament (champion crowned)\n");
		console.log("Options:");
		console.log("  --force, -f  Skip confirmation prompt\n");
		console.log("Examples:");
		console.log("  deno task db:seed active");
		console.log("  deno task db:seed finished --force");
		Deno.exit(1);
	}

	return { phase, force };
}

function toSqliteTimestamp(date: Date | null): number | null {
	return date ? Math.floor(date.getTime() / 1000) : null;
}

function escapeString(str: string | null | undefined): string {
	if (str === null || str === undefined) return "NULL";
	return `'${str.replace(/'/g, "''")}'`;
}

function createCompetitors(bracketId: string, phase: Phase): NewCompetitor[] {
	const now = new Date();

	return MOCK_COMPETITORS.map((c, index) => {
		const isConfirmed = phase === "interest" ? index < 5 : true;

		return {
			id: createId(),
			bracketId,
			name: c.name,
			displayName: c.displayName,
			imageUrl: `https://api.dicebear.com/9.x/bottts/svg?seed=${c.name}`,
			seed: isConfirmed ? index + 1 : null,
			userId: `mock-user-${index + 1}`,
			confirmed: isConfirmed,
			confirmedAt: isConfirmed ? now : null,
			createdAt: now,
		};
	});
}

function createBracket(phase: Phase): NewBracket & { id: string } {
	const now = new Date();
	const statusMap: Record<Phase, Bracket["status"]> = {
		interest: "registration",
		active: "active",
		finished: "completed",
	};

	const nameMap: Record<Phase, string> = {
		interest: "Klustered Season 4",
		active: "Klustered Season 4",
		finished: "Klustered Season 3",
	};

	const slugMap: Record<Phase, string> = {
		interest: "klustered-season-4",
		active: "klustered-season-4",
		finished: "klustered-season-3",
	};

	const startedAt =
		phase === "active"
			? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
			: phase === "finished"
				? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
				: null;

	const completedAt =
		phase === "finished"
			? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
			: null;

	return {
		id: createId(),
		name: nameMap[phase],
		slug: slugMap[phase],
		description:
			"The ultimate Kubernetes troubleshooting competition. Competitors race to fix broken clusters.",
		type: "solo",
		status: statusMap[phase],
		createdAt: now,
		updatedAt: now,
		startedAt,
		completedAt,
	};
}

function simulateActiveTournament(matchList: NewMatch[]): NewMatch[] {
	const now = new Date();

	const round1Matches = matchList.filter((m) => m.round === 1);
	const round2Matches = matchList.filter((m) => m.round === 2);

	// Complete first 2 matches of round 1
	for (let i = 0; i < 2 && i < round1Matches.length; i++) {
		const match = round1Matches[i];
		const winnerId = match.competitor1Id;
		match.winnerId = winnerId;
		match.status = "completed";
		match.completedAt = new Date(now.getTime() - (2 - i) * 24 * 60 * 60 * 1000);
		match.vodUrl = `https://youtube.com/watch?v=mock-vod-${i + 1}`;

		if (round2Matches.length > 0 && winnerId) {
			const nextPosition = Math.floor(match.position / 2);
			const nextMatch = round2Matches.find((m) => m.position === nextPosition);
			if (nextMatch) {
				if (match.position % 2 === 0) {
					nextMatch.competitor1Id = winnerId;
				} else {
					nextMatch.competitor2Id = winnerId;
				}
			}
		}
	}

	if (round1Matches.length > 2) {
		const liveMatch = round1Matches[2];
		liveMatch.status = "live";
		liveMatch.scheduledAt = now;
		liveMatch.streamUrl = "https://twitch.tv/rawkode";
	}

	if (round1Matches.length > 3) {
		const scheduledMatch = round1Matches[3];
		scheduledMatch.status = "scheduled";
		scheduledMatch.scheduledAt = new Date(
			now.getTime() + 2 * 24 * 60 * 60 * 1000,
		);
	}

	for (const match of round2Matches) {
		match.scheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	}

	return matchList;
}

function simulateFinishedTournament(matchList: NewMatch[]): NewMatch[] {
	const now = new Date();
	const baseDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const matchesByRound = new Map<number, NewMatch[]>();
	for (const match of matchList) {
		const roundMatches = matchesByRound.get(match.round) ?? [];
		roundMatches.push(match);
		matchesByRound.set(match.round, roundMatches);
	}

	const maxRound = Math.max(...matchList.map((m) => m.round));

	for (let round = 1; round <= maxRound; round++) {
		const roundMatches = matchesByRound.get(round) ?? [];
		const nextRoundMatches = matchesByRound.get(round + 1) ?? [];
		const daysOffset = (round - 1) * 7;

		for (const match of roundMatches) {
			if (match.status === "completed") {
				continue;
			}

			const winnerId = match.competitor1Id ?? match.competitor2Id;
			match.winnerId = winnerId;
			match.status = "completed";
			match.completedAt = new Date(
				baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000,
			);
			match.scheduledAt = match.completedAt;
			match.vodUrl = `https://youtube.com/watch?v=mock-vod-r${round}-p${match.position}`;

			if (winnerId && round < maxRound) {
				const nextPosition = Math.floor(match.position / 2);
				const nextMatch = nextRoundMatches.find(
					(m) => m.position === nextPosition,
				);
				if (nextMatch) {
					if (match.position % 2 === 0) {
						nextMatch.competitor1Id = winnerId;
					} else {
						nextMatch.competitor2Id = winnerId;
					}
				}
			}
		}
	}

	return matchList;
}

function generateSql(
	bracket: NewBracket & { id: string },
	competitorList: NewCompetitor[],
	matchList: NewMatch[],
): string {
	const statements: string[] = [];

	// Clear existing data
	statements.push("DELETE FROM matches;");
	statements.push("DELETE FROM competitors;");
	statements.push("DELETE FROM brackets;");

	// Insert bracket
	statements.push(`INSERT INTO brackets (id, name, slug, description, type, status, created_at, updated_at, started_at, completed_at)
VALUES (
  ${escapeString(bracket.id)},
  ${escapeString(bracket.name)},
  ${escapeString(bracket.slug)},
  ${escapeString(bracket.description)},
  ${escapeString(bracket.type)},
  ${escapeString(bracket.status)},
  ${toSqliteTimestamp(bracket.createdAt as Date)},
  ${toSqliteTimestamp(bracket.updatedAt as Date)},
  ${toSqliteTimestamp(bracket.startedAt as Date | null)},
  ${toSqliteTimestamp(bracket.completedAt as Date | null)}
);`);

	// Insert competitors
	for (const c of competitorList) {
		statements.push(`INSERT INTO competitors (id, bracket_id, name, display_name, image_url, seed, user_id, confirmed, confirmed_at, created_at)
VALUES (
  ${escapeString(c.id)},
  ${escapeString(c.bracketId)},
  ${escapeString(c.name)},
  ${escapeString(c.displayName)},
  ${escapeString(c.imageUrl)},
  ${c.seed ?? "NULL"},
  ${escapeString(c.userId)},
  ${c.confirmed ? 1 : 0},
  ${toSqliteTimestamp(c.confirmedAt as Date | null)},
  ${toSqliteTimestamp(c.createdAt as Date)}
);`);
	}

	// Insert matches
	for (const m of matchList) {
		statements.push(`INSERT INTO matches (id, bracket_id, round, position, competitor1_id, competitor2_id, winner_id, status, scheduled_at, stream_url, vod_url, notes, created_at, updated_at, completed_at)
VALUES (
  ${escapeString(createId())},
  ${escapeString(m.bracketId)},
  ${m.round},
  ${m.position},
  ${escapeString(m.competitor1Id)},
  ${escapeString(m.competitor2Id)},
  ${escapeString(m.winnerId)},
  ${escapeString(m.status)},
  ${toSqliteTimestamp(m.scheduledAt as Date | null)},
  ${escapeString(m.streamUrl)},
  ${escapeString(m.vodUrl)},
  ${escapeString(m.notes)},
  ${toSqliteTimestamp(new Date())},
  ${toSqliteTimestamp(new Date())},
  ${toSqliteTimestamp(m.completedAt as Date | null)}
);`);
	}

	return statements.join("\n\n");
}

async function seed(): Promise<void> {
	const { phase, force } = parseArgs();

	console.log("Klustered.dev Database Seeder");
	console.log("=============================");
	console.log(`\nGenerating ${phase} phase data...`);

	const dbPath = getLocalDbPath();
	console.log(`Database found: ${dbPath}`);

	if (!force) {
		const confirm = prompt(
			"\nThis will delete all existing bracket data. Continue? (y/N):",
		);
		if (confirm?.toLowerCase() !== "y") {
			console.log("Aborted.");
			Deno.exit(0);
		}
	}

	// Generate data
	const bracket = createBracket(phase);
	const competitorList = createCompetitors(bracket.id, phase);

	let matchList: NewMatch[] = [];
	if (phase !== "interest") {
		const confirmedCompetitors = competitorList.filter((c) => c.confirmed);
		matchList = generateSingleEliminationBracket(
			bracket.id,
			confirmedCompetitors as Competitor[],
		);

		if (phase === "active") {
			matchList = simulateActiveTournament(matchList);
		} else if (phase === "finished") {
			matchList = simulateFinishedTournament(matchList);
		}
	}

	// Generate SQL
	const sql = generateSql(bracket, competitorList, matchList);

	// Write to temp file and execute with sqlite3
	const tempFile = "/tmp/klustered-seed.sql";
	await Deno.writeTextFile(tempFile, sql);

	const command = new Deno.Command("sqlite3", {
		args: [dbPath, `.read ${tempFile}`],
		stdout: "piped",
		stderr: "piped",
	});

	const { code, stderr } = await command.output();

	if (code !== 0) {
		const errorText = new TextDecoder().decode(stderr);
		console.error("Failed to execute SQL:", errorText);
		Deno.exit(1);
	}

	// Clean up
	await Deno.remove(tempFile);

	console.log(`\nCreated bracket: ${bracket.name} (${bracket.status})`);
	const confirmedCount = competitorList.filter((c) => c.confirmed).length;
	console.log(
		`Created ${competitorList.length} competitors (${confirmedCount} confirmed)`,
	);

	if (matchList.length > 0) {
		const completedCount = matchList.filter(
			(m) => m.status === "completed",
		).length;
		const liveCount = matchList.filter((m) => m.status === "live").length;
		console.log(
			`Created ${matchList.length} matches (${completedCount} completed, ${liveCount} live)`,
		);
	}

	console.log("\nSeeding complete!");
	console.log(
		`\nRun 'deno task dev' and visit http://localhost:4322/bracket/${bracket.slug}`,
	);
}

seed().catch((error) => {
	console.error("Seeding failed:", error);
	Deno.exit(1);
});
