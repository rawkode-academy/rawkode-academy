import { WorkerEntrypoint } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../data-model/schema";
import {
	DecideRegistration,
	GenerateBracket,
	RecordResult,
	SetMatchLiveState,
	SubmitRegistration,
} from "../data-model/integrations/zod";

export { GenerateBracketWorkflow } from "./generateBracket";
export { RecordResultWorkflow } from "./recordResult";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
	generateBracket: Workflow;
	recordResult: Workflow;
}

type Db = ReturnType<typeof drizzle>;

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
}

/**
 * Command surface for the brackets domain. Callers (the klustered.dev admin and
 * the public apply form, via service bindings) invoke these RPC methods; no
 * caller writes D1 directly. Durable multi-step operations (generate, record
 * result) are delegated to Cloudflare Workflows.
 */
export class BracketsWriteModel extends WorkerEntrypoint<Env> {
	private get db(): Db {
		return drizzle(this.env.DB);
	}

	async fetch(): Promise<Response> {
		return new Response("ok", { headers: { "Content-Type": "text/plain" } });
	}

	// ---- registrations ----

	async submitRegistration(input: unknown): Promise<{ id: string }> {
		const data = SubmitRegistration.parse(input);
		const bracket = await this.db
			.select({
				id: s.brackets.id,
				seasonId: s.brackets.seasonId,
				kind: s.brackets.kind,
				status: s.brackets.status,
			})
			.from(s.brackets)
			.where(eq(s.brackets.id, data.bracketId))
			.get();
		if (!bracket || bracket.status === "finished") {
			throw new Error("bracket not open");
		}
		if (bracket.kind === "team" && !data.teamName) {
			throw new Error("teamName required for team bracket entries");
		}

		const id = `reg-${crypto.randomUUID()}`;
		await this.db.insert(s.registrations).values({
			id,
			seasonId: bracket.seasonId,
			bracketId: data.bracketId,
			entryType: bracket.kind,
			teamName: data.teamName ?? null,
			preferredSlot: data.preferredSlot ?? null,
			userId: data.userId ?? null,
			displayName: data.displayName,
			email: data.email,
			message: data.message ?? null,
			submittedAt: new Date(),
		});
		return { id };
	}

	async decideRegistration(input: unknown): Promise<{ ok: true }> {
		const data = DecideRegistration.parse(input);
		await this.db
			.update(s.registrations)
			.set({
				status: data.decision,
				reviewedAt: new Date(),
				reviewedByUserId: data.reviewedByUserId,
			})
			.where(eq(s.registrations.id, data.registrationId));

		if (data.decision === "approved") {
			await this.createBracketEntryFromRegistration(data.registrationId);
		}
		return { ok: true };
	}

	private async createBracketEntryFromRegistration(
		registrationId: string,
	): Promise<void> {
		const db = this.db;
		const registration = await db
			.select()
			.from(s.registrations)
			.where(eq(s.registrations.id, registrationId))
			.get();
		if (!registration || !registration.bracketId) return;

		const existing = await db
			.select({ id: s.bracketEntries.id })
			.from(s.bracketEntries)
			.where(eq(s.bracketEntries.id, `entry-${registration.id}`))
			.get();
		if (existing) return;

		const bracket = await db
			.select()
			.from(s.brackets)
			.where(eq(s.brackets.id, registration.bracketId))
			.get();
		if (!bracket) return;

		const preferredSlot = registration.preferredSlot;
		let seed: number | null = null;
		if (preferredSlot && preferredSlot > 0 && preferredSlot <= bracket.maxEntries) {
			const existingSlot = await db
				.select({ id: s.bracketEntries.id })
				.from(s.bracketEntries)
				.where(
					and(
						eq(s.bracketEntries.bracketId, bracket.id),
						eq(s.bracketEntries.seed, preferredSlot),
					),
				)
				.get();
			if (!existingSlot) seed = preferredSlot;
		}
		const lastEntry = await db
			.select({ seed: s.bracketEntries.seed })
			.from(s.bracketEntries)
			.where(eq(s.bracketEntries.bracketId, bracket.id))
			.orderBy(desc(s.bracketEntries.seed))
			.get();
		const resolvedSeed = seed ?? (lastEntry?.seed ?? 0) + 1;
		if (resolvedSeed > bracket.maxEntries) return;

		const competitorId = `cmp-${registration.id}`;
		const displaySlug = slugify(registration.displayName || registration.email);
		await db.insert(s.competitors).values({
			id: competitorId,
			seasonId: registration.seasonId,
			personSlug: `${displaySlug}-${registration.id.slice(-6)}`,
			displayName: registration.displayName,
			userId: registration.userId,
		});

		let teamId: string | null = null;
		if (bracket.kind === "team") {
			teamId = `team-${registration.id}`;
			const teamName = registration.teamName ?? registration.displayName;
			await db.insert(s.teams).values({
				id: teamId,
				seasonId: registration.seasonId,
				name: teamName,
				slug: `${slugify(teamName)}-${registration.id.slice(-6)}`,
			});
			await db
				.insert(s.teamMembers)
				.values({ teamId, competitorId, role: "captain" });
		}

		await db.insert(s.bracketEntries).values({
			id: `entry-${registration.id}`,
			bracketId: bracket.id,
			competitorId: bracket.kind === "solo" ? competitorId : null,
			teamId,
			displayName:
				bracket.kind === "team"
					? (registration.teamName ?? registration.displayName)
					: registration.displayName,
			seed: resolvedSeed,
			status: "confirmed",
		});
	}

	// ---- matches ----

	async generateBracket(input: unknown): Promise<{ workflowId: string }> {
		const data = GenerateBracket.parse(input);
		const instance = await this.env.generateBracket.create({ params: data });
		return { workflowId: instance.id };
	}

	async recordResult(input: unknown): Promise<{ workflowId: string }> {
		const data = RecordResult.parse(input);
		const instance = await this.env.recordResult.create({ params: data });
		return { workflowId: instance.id };
	}

	async setMatchLiveState(input: unknown): Promise<{ ok: true }> {
		const data = SetMatchLiveState.parse(input);
		const patch: Partial<typeof s.matches.$inferInsert> = { status: data.state };
		if (data.state === "live") patch.startedAt = new Date();
		await this.db
			.update(s.matches)
			.set(patch)
			.where(eq(s.matches.id, data.matchId));
		return { ok: true };
	}

	// ---- entity CRUD (trusted admin caller) ----

	async createSeason(input: {
		showId: string;
		slug: string;
		name: string;
		status?: "interest" | "active" | "finished";
		startDate?: number | null;
		endDate?: number | null;
	}): Promise<{ id: string }> {
		const id = `season-${crypto.randomUUID()}`;
		await this.db.insert(s.seasons).values({
			id,
			showId: input.showId,
			slug: input.slug,
			name: input.name,
			status: input.status ?? "interest",
			startDate: input.startDate ? new Date(input.startDate) : null,
			endDate: input.endDate ? new Date(input.endDate) : null,
		});
		return { id };
	}

	async createBracket(input: {
		seasonId: string;
		name: string;
		slug: string;
		kind?: "solo" | "team";
		startsAt?: number | null;
		registrationClosesAt?: number | null;
		maxEntries?: number;
		cadenceDays?: number;
	}): Promise<{ id: string }> {
		const id = `bracket-${crypto.randomUUID()}`;
		await this.db.insert(s.brackets).values({
			id,
			seasonId: input.seasonId,
			name: input.name,
			slug: input.slug,
			kind: input.kind ?? "team",
			startsAt: input.startsAt ? new Date(input.startsAt) : null,
			registrationClosesAt: input.registrationClosesAt
				? new Date(input.registrationClosesAt)
				: null,
			maxEntries: input.maxEntries ?? 16,
			cadenceDays: input.cadenceDays ?? 7,
		});
		return { id };
	}

	async createScenario(input: {
		slug: string;
		title: string;
		description: string;
		difficulty?: "easy" | "medium" | "hard";
		tags?: string[];
		notes?: string | null;
	}): Promise<{ id: string }> {
		const id = `scn-${crypto.randomUUID()}`;
		await this.db.insert(s.scenarios).values({
			id,
			slug: input.slug,
			title: input.title,
			description: input.description,
			difficulty: input.difficulty ?? "medium",
			tags: input.tags ?? [],
			notes: input.notes ?? null,
		});
		return { id };
	}

	async createBracketBreak(input: {
		bracketId: string;
		label: string;
		startsAt: number;
		endsAt: number;
	}): Promise<{ id: string }> {
		const id = `brk-${crypto.randomUUID()}`;
		await this.db.insert(s.bracketBreaks).values({
			id,
			bracketId: input.bracketId,
			label: input.label,
			startsAt: new Date(input.startsAt),
			endsAt: new Date(input.endsAt),
		});
		return { id };
	}

	async deleteSeason(input: { id: string }): Promise<{ ok: true }> {
		await this.db.delete(s.seasons).where(eq(s.seasons.id, input.id));
		return { ok: true };
	}

	async deleteBracket(input: { id: string }): Promise<{ ok: true }> {
		await this.db.delete(s.brackets).where(eq(s.brackets.id, input.id));
		return { ok: true };
	}

	async deleteScenario(input: { id: string }): Promise<{ ok: true }> {
		await this.db.delete(s.scenarios).where(eq(s.scenarios.id, input.id));
		return { ok: true };
	}

	async deleteBracketBreak(input: { id: string }): Promise<{ ok: true }> {
		await this.db
			.delete(s.bracketBreaks)
			.where(eq(s.bracketBreaks.id, input.id));
		return { ok: true };
	}
}

export default BracketsWriteModel;
