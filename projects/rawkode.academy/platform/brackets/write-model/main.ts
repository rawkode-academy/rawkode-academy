import { WorkerEntrypoint } from "cloudflare:workers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createId } from "@paralleldrive/cuid2";
import * as s from "../data-model/schema";
import {
	CreateTeamInvite,
	DecideRegistration,
	FormTeam,
	GenerateBracket,
	JoinTeamViaInvite,
	LeaveTeam,
	RecordResult,
	RenameTeam,
	RevokeTeamInvite,
	SelfRegisterCompetitor,
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

	private async getBracket(bracketId: string) {
		const bracket = await this.db
			.select()
			.from(s.brackets)
			.where(eq(s.brackets.id, bracketId))
			.get();
		if (!bracket || bracket.status === "finished") {
			throw new Error("bracket not open");
		}
		return bracket;
	}

	private async getOpenBracket(bracketId: string) {
		const bracket = await this.getBracket(bracketId);
		if (
			bracket.registrationClosesAt &&
			bracket.registrationClosesAt.getTime() <= Date.now()
		) {
			throw new Error("registration closed");
		}
		return bracket;
	}

	private async uniqueCompetitorSlug(
		seasonId: string,
		displayName: string,
	): Promise<string> {
		const base = slugify(displayName) || "competitor";
		for (let attempt = 0; attempt < 100; attempt++) {
			const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
			const existing = await this.db
				.select({ id: s.competitors.id })
				.from(s.competitors)
				.where(
					and(
						eq(s.competitors.seasonId, seasonId),
						eq(s.competitors.personSlug, slug),
					),
				)
				.get();
			if (!existing) return slug;
		}
		return `${base}-${createId()}`;
	}

	private async uniqueTeamSlug(
		bracketId: string,
		name: string,
		exceptTeamId?: string,
	): Promise<string> {
		const base = slugify(name) || "team";
		for (let attempt = 0; attempt < 100; attempt++) {
			const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
			const existing = await this.db
				.select({ id: s.teams.id })
				.from(s.teams)
				.where(and(eq(s.teams.bracketId, bracketId), eq(s.teams.slug, slug)))
				.get();
			if (!existing || existing.id === exceptTeamId) return slug;
		}
		return `${base}-${createId()}`;
	}

	private async getOrCreateCompetitor(input: {
		seasonId: string;
		userId: string;
		displayName: string;
	}) {
		const existing = await this.db
			.select()
			.from(s.competitors)
			.where(
				and(
					eq(s.competitors.seasonId, input.seasonId),
					eq(s.competitors.userId, input.userId),
				),
			)
			.get();
		if (existing) return existing;

		const id = `cmp-${crypto.randomUUID()}`;
		const personSlug = await this.uniqueCompetitorSlug(
			input.seasonId,
			input.displayName,
		);
		try {
			await this.db.insert(s.competitors).values({
				id,
				seasonId: input.seasonId,
				personSlug,
				displayName: input.displayName,
				userId: input.userId,
			});
		} catch {
			const concurrent = await this.db
				.select()
				.from(s.competitors)
				.where(
					and(
						eq(s.competitors.seasonId, input.seasonId),
						eq(s.competitors.userId, input.userId),
					),
				)
				.get();
			if (concurrent) return concurrent;
			throw new Error("could not create competitor");
		}

		const created = await this.db
			.select()
			.from(s.competitors)
			.where(eq(s.competitors.id, id))
			.get();
		if (!created) throw new Error("could not create competitor");
		return created;
	}

	private async ensureBracketApplication(
		bracketId: string,
		competitorId: string,
	): Promise<void> {
		await this.db
			.insert(s.bracketApplications)
			.values({
				id: `app-${crypto.randomUUID()}`,
				bracketId,
				competitorId,
			})
			.onConflictDoNothing({
				target: [
					s.bracketApplications.bracketId,
					s.bracketApplications.competitorId,
				],
			});
	}

	private async requireApplied(
		bracketId: string,
		competitorId: string,
	): Promise<void> {
		const application = await this.db
			.select({ id: s.bracketApplications.id })
			.from(s.bracketApplications)
			.where(
				and(
					eq(s.bracketApplications.bracketId, bracketId),
					eq(s.bracketApplications.competitorId, competitorId),
				),
			)
			.get();
		if (!application) throw new Error("apply before forming a team");
	}

	private async membershipForCompetitor(
		bracketId: string,
		competitorId: string,
	) {
		return this.db
			.select()
			.from(s.teamMembers)
			.where(
				and(
					eq(s.teamMembers.bracketId, bracketId),
					eq(s.teamMembers.competitorId, competitorId),
				),
			)
			.get();
	}

	private async memberCount(teamId: string): Promise<number> {
		const members = await this.db
			.select({ competitorId: s.teamMembers.competitorId })
			.from(s.teamMembers)
			.where(eq(s.teamMembers.teamId, teamId))
			.all();
		return members.length;
	}

	private async requireTeamActor(
		teamId: string,
		userId: string,
		requireCaptain = false,
	) {
		const team = await this.db
			.select()
			.from(s.teams)
			.where(eq(s.teams.id, teamId))
			.get();
		if (!team) throw new Error("team not found");

		const competitor = await this.db
			.select()
			.from(s.competitors)
			.where(
				and(
					eq(s.competitors.seasonId, team.seasonId),
					eq(s.competitors.userId, userId),
				),
			)
			.get();
		if (!competitor) throw new Error("competitor not found");

		const membership = await this.db
			.select()
			.from(s.teamMembers)
			.where(
				and(
					eq(s.teamMembers.teamId, teamId),
					eq(s.teamMembers.competitorId, competitor.id),
				),
			)
			.get();
		if (!membership) throw new Error("not a team member");
		if (requireCaptain && membership.role !== "captain") {
			throw new Error("captain only");
		}

		return { team, competitor, membership };
	}

	private async mintTeamInvite(input: {
		teamId: string;
		bracketId: string;
		createdByUserId: string;
	}): Promise<{ token: string }> {
		await this.db
			.update(s.teamInvites)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(s.teamInvites.teamId, input.teamId),
					isNull(s.teamInvites.revokedAt),
				),
			);
		const token = createId();
		await this.db.insert(s.teamInvites).values({
			token,
			teamId: input.teamId,
			bracketId: input.bracketId,
			createdByUserId: input.createdByUserId,
		});
		return { token };
	}

	// ---- self-service applications and teams ----

	async selfRegisterCompetitor(input: unknown): Promise<{
		competitorId: string;
		seasonId: string;
		bracketKind: "solo" | "team";
	}> {
		const data = SelfRegisterCompetitor.parse(input);
		const bracket = await this.getOpenBracket(data.bracketId);
		const competitor = await this.getOrCreateCompetitor({
			seasonId: bracket.seasonId,
			userId: data.userId,
			displayName: data.displayName,
		});
		await this.ensureBracketApplication(bracket.id, competitor.id);
		return {
			competitorId: competitor.id,
			seasonId: bracket.seasonId,
			bracketKind: bracket.kind,
		};
	}

	async formTeam(input: unknown): Promise<{ teamId: string; token: string }> {
		const data = FormTeam.parse(input);
		const bracket = await this.getOpenBracket(data.bracketId);
		if (bracket.kind !== "team") throw new Error("team bracket required");

		const competitor = await this.db
			.select()
			.from(s.competitors)
			.where(
				and(
					eq(s.competitors.seasonId, bracket.seasonId),
					eq(s.competitors.userId, data.userId),
				),
			)
			.get();
		if (!competitor) throw new Error("competitor not found");
		await this.requireApplied(bracket.id, competitor.id);

		const existingMembership = await this.membershipForCompetitor(
			bracket.id,
			competitor.id,
		);
		if (existingMembership) throw new Error("already on a team");

		const teamId = `team-${crypto.randomUUID()}`;
		const slug = await this.uniqueTeamSlug(bracket.id, data.name);
		await this.db.insert(s.teams).values({
			id: teamId,
			seasonId: bracket.seasonId,
			bracketId: bracket.id,
			name: data.name,
			slug,
		});
		await this.db.insert(s.teamMembers).values({
			teamId,
			bracketId: bracket.id,
			competitorId: competitor.id,
			role: "captain",
		});
		const invite = await this.mintTeamInvite({
			teamId,
			bracketId: bracket.id,
			createdByUserId: data.userId,
		});
		return { teamId, token: invite.token };
	}

	async joinTeamViaInvite(
		input: unknown,
	): Promise<{ teamId: string; seasonId: string }> {
		const data = JoinTeamViaInvite.parse(input);
		const invite = await this.db
			.select()
			.from(s.teamInvites)
			.where(eq(s.teamInvites.token, data.token))
			.get();
		if (!invite || invite.revokedAt) throw new Error("invite not valid");

		const team = await this.db
			.select()
			.from(s.teams)
			.where(eq(s.teams.id, invite.teamId))
			.get();
		if (!team) throw new Error("team not found");

		const bracket = await this.getOpenBracket(invite.bracketId);
		if (bracket.kind !== "team") throw new Error("team bracket required");

		const competitor = await this.getOrCreateCompetitor({
			seasonId: team.seasonId,
			userId: data.userId,
			displayName: data.displayName,
		});

		const existingMembership = await this.membershipForCompetitor(
			bracket.id,
			competitor.id,
		);
		if (existingMembership) {
			if (existingMembership.teamId !== team.id)
				throw new Error("already on a team");
			await this.ensureBracketApplication(bracket.id, competitor.id);
			return { teamId: team.id, seasonId: team.seasonId };
		}

		if ((await this.memberCount(team.id)) >= bracket.teamSize) {
			throw new Error("team full");
		}

		await this.db.insert(s.teamMembers).values({
			teamId: team.id,
			bracketId: bracket.id,
			competitorId: competitor.id,
			role: "member",
		});
		await this.ensureBracketApplication(bracket.id, competitor.id);
		return { teamId: team.id, seasonId: team.seasonId };
	}

	async renameTeam(input: unknown): Promise<{ ok: true }> {
		const data = RenameTeam.parse(input);
		const { team } = await this.requireTeamActor(
			data.teamId,
			data.userId,
			true,
		);
		const slug = await this.uniqueTeamSlug(team.bracketId, data.name, team.id);
		await this.db
			.update(s.teams)
			.set({ name: data.name, slug })
			.where(eq(s.teams.id, data.teamId));
		return { ok: true };
	}

	async createTeamInvite(input: unknown): Promise<{ token: string }> {
		const data = CreateTeamInvite.parse(input);
		const { team } = await this.requireTeamActor(
			data.teamId,
			data.userId,
			true,
		);
		return this.mintTeamInvite({
			teamId: team.id,
			bracketId: team.bracketId,
			createdByUserId: data.userId,
		});
	}

	async revokeTeamInvite(input: unknown): Promise<{ ok: true }> {
		const data = RevokeTeamInvite.parse(input);
		const invite = await this.db
			.select()
			.from(s.teamInvites)
			.where(eq(s.teamInvites.token, data.token))
			.get();
		if (!invite) return { ok: true };
		await this.requireTeamActor(invite.teamId, data.userId, true);
		await this.db
			.update(s.teamInvites)
			.set({ revokedAt: new Date() })
			.where(eq(s.teamInvites.token, data.token));
		return { ok: true };
	}

	async leaveTeam(input: unknown): Promise<{ ok: true }> {
		const data = LeaveTeam.parse(input);
		const { team, competitor, membership } = await this.requireTeamActor(
			data.teamId,
			data.userId,
		);
		const count = await this.memberCount(team.id);
		if (membership.role === "captain" && count > 1) {
			throw new Error("captain cannot leave while team has members");
		}
		await this.db
			.delete(s.teamMembers)
			.where(
				and(
					eq(s.teamMembers.teamId, team.id),
					eq(s.teamMembers.competitorId, competitor.id),
				),
			);
		if (count <= 1) {
			await this.db
				.update(s.teamInvites)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(s.teamInvites.teamId, team.id),
						isNull(s.teamInvites.revokedAt),
					),
				);
			await this.db.delete(s.teams).where(eq(s.teams.id, team.id));
		}
		return { ok: true };
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
		if (
			preferredSlot &&
			preferredSlot > 0 &&
			preferredSlot <= bracket.maxEntries
		) {
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
				bracketId: bracket.id,
				name: teamName,
				slug: `${slugify(teamName)}-${registration.id.slice(-6)}`,
			});
			await db.insert(s.teamMembers).values({
				teamId,
				bracketId: bracket.id,
				competitorId,
				role: "captain",
			});
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
		const patch: Partial<typeof s.matches.$inferInsert> = {
			status: data.state,
		};
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
		startsAt: number;
		registrationClosesAt?: number | null;
		maxEntries?: number;
		teamSize?: number;
		cadenceDays?: number;
	}): Promise<{ id: string }> {
		if (!Number.isFinite(input.startsAt)) {
			throw new Error("startsAt required");
		}
		const id = `bracket-${crypto.randomUUID()}`;
		await this.db.insert(s.brackets).values({
			id,
			seasonId: input.seasonId,
			name: input.name,
			slug: input.slug,
			kind: input.kind ?? "team",
			startsAt: new Date(input.startsAt),
			registrationClosesAt: input.registrationClosesAt
				? new Date(input.registrationClosesAt)
				: null,
			maxEntries: input.maxEntries ?? 16,
			teamSize: input.teamSize ?? 4,
			cadenceDays: input.cadenceDays ?? 7,
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

	async deleteBracketBreak(input: { id: string }): Promise<{ ok: true }> {
		await this.db
			.delete(s.bracketBreaks)
			.where(eq(s.bracketBreaks.id, input.id));
		return { ok: true };
	}

	// ---- competitors ----

	async createCompetitor(input: {
		seasonId: string;
		personSlug: string;
		displayName: string;
		bio?: string | null;
		userId?: string | null;
	}): Promise<{ id: string }> {
		const id = `cmp-${crypto.randomUUID()}`;
		await this.db.insert(s.competitors).values({
			id,
			seasonId: input.seasonId,
			personSlug: input.personSlug,
			displayName: input.displayName,
			bio: input.bio ?? null,
			userId: input.userId ?? null,
		});
		return { id };
	}

	async deleteCompetitor(input: { id: string }): Promise<{ ok: true }> {
		await this.db.delete(s.competitors).where(eq(s.competitors.id, input.id));
		return { ok: true };
	}

	// ---- teams ----

	async createTeam(input: {
		bracketId: string;
		slug: string;
		name: string;
	}): Promise<{ id: string }> {
		const bracket = await this.getBracket(input.bracketId);
		if (bracket.kind !== "team") throw new Error("team bracket required");
		const id = `team-${crypto.randomUUID()}`;
		await this.db.insert(s.teams).values({
			id,
			seasonId: bracket.seasonId,
			bracketId: bracket.id,
			slug: input.slug,
			name: input.name,
		});
		return { id };
	}

	async deleteTeam(input: { id: string }): Promise<{ ok: true }> {
		await this.db.delete(s.teams).where(eq(s.teams.id, input.id));
		return { ok: true };
	}

	async addTeamMember(input: {
		teamId: string;
		competitorId: string;
		role?: string | null;
	}): Promise<{ ok: true }> {
		const team = await this.db
			.select()
			.from(s.teams)
			.where(eq(s.teams.id, input.teamId))
			.get();
		if (!team) throw new Error("team not found");
		await this.db.insert(s.teamMembers).values({
			teamId: input.teamId,
			bracketId: team.bracketId,
			competitorId: input.competitorId,
			role: input.role ?? null,
		});
		return { ok: true };
	}

	async removeTeamMember(input: {
		teamId: string;
		competitorId: string;
	}): Promise<{ ok: true }> {
		await this.db
			.delete(s.teamMembers)
			.where(
				and(
					eq(s.teamMembers.teamId, input.teamId),
					eq(s.teamMembers.competitorId, input.competitorId),
				),
			);
		return { ok: true };
	}

	// ---- matches ----

	async editMatch(input: {
		matchId: string;
		entryAId?: string | null;
		entryBId?: string | null;
		judgeUserId?: string | null;
		scheduledAt?: number | null;
		status?: "scheduled" | "live" | "completed" | "cancelled";
	}): Promise<{ ok: true }> {
		// Team ids are derived from the chosen entries.
		const teamFor = async (entryId: string | null | undefined) => {
			if (!entryId) return null;
			const entry = await this.db
				.select({ teamId: s.bracketEntries.teamId })
				.from(s.bracketEntries)
				.where(eq(s.bracketEntries.id, entryId))
				.get();
			return entry?.teamId ?? null;
		};

		const patch: Partial<typeof s.matches.$inferInsert> = {};
		if (input.entryAId !== undefined) {
			patch.entryAId = input.entryAId;
			patch.teamAId = await teamFor(input.entryAId);
		}
		if (input.entryBId !== undefined) {
			patch.entryBId = input.entryBId;
			patch.teamBId = await teamFor(input.entryBId);
		}
		if (input.judgeUserId !== undefined) patch.judgeUserId = input.judgeUserId;
		if (input.scheduledAt !== undefined) {
			patch.scheduledAt = input.scheduledAt
				? new Date(input.scheduledAt)
				: null;
		}
		if (input.status !== undefined) patch.status = input.status;

		await this.db
			.update(s.matches)
			.set(patch)
			.where(eq(s.matches.id, input.matchId));
		return { ok: true };
	}
}

export default BracketsWriteModel;
