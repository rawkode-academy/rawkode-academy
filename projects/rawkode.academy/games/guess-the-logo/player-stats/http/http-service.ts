import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

export type AttemptStatus = "playing" | "completed" | "out_of_lives";

export interface DailyChallenge {
	date: string;
	techIds: string[];
}

export interface AttemptState {
	date: string;
	status: AttemptStatus;
	currentIndex: number;
	livesRemaining: number;
	finalTimeMs: number | null;
}

export interface GuessResult {
	correct: boolean;
	status: AttemptStatus;
	currentIndex: number;
	livesRemaining: number;
	finalTimeMs: number | null;
}

export interface ActivityDay {
	date: string;
	logosCorrect: number;
}

function getUtcDayKey(date = new Date()): string {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function addUtcDays(dayKey: string, delta: number): string {
	const [y, m, d] = dayKey.split("-").map((n) => Number.parseInt(n, 10));
	const date = new Date(Date.UTC(y!, (m! - 1), d!));
	date.setUTCDate(date.getUTCDate() + delta);
	return getUtcDayKey(date);
}

function parseTechIds(json: string): string[] {
	const v = JSON.parse(json) as unknown;
	if (!Array.isArray(v)) return [];
	return v.filter((x): x is string => typeof x === "string");
}

export class GtlPlayerStats extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}
		return new Response("Not Found", { status: 404 });
	}

	async getDailyChallenge(date: string): Promise<DailyChallenge | null> {
		const row = await this.db.query.dailyChallengesTable.findFirst({
			where: eq(dataSchema.dailyChallengesTable.date, date),
		});
		if (!row) return null;
		return {
			date: row.date,
			techIds: parseTechIds(row.techIdsJson),
		};
	}

	async ensureDailyChallenge(date: string, techIds: string[]): Promise<DailyChallenge> {
		if (!Array.isArray(techIds) || techIds.length !== 5) {
			throw new Error("techIds must be an array of 5 items");
		}
		const unique = new Set(techIds);
		if (unique.size !== techIds.length) {
			throw new Error("techIds must be unique");
		}

		await this.db
			.insert(dataSchema.dailyChallengesTable)
			.values({
				date,
				techIdsJson: JSON.stringify(techIds),
				createdAt: new Date(),
			})
			.onConflictDoNothing();

		const stored = await this.getDailyChallenge(date);
		if (!stored) throw new Error("Failed to ensure daily challenge");
		return stored;
	}

	async getAttempt(personId: string, date: string): Promise<AttemptState | null> {
		const row = await this.db.query.attemptsTable.findFirst({
			where: and(
				eq(dataSchema.attemptsTable.personId, personId),
				eq(dataSchema.attemptsTable.date, date),
			),
		});
		if (!row) return null;
		return {
			date: row.date,
			status: row.status as AttemptStatus,
			currentIndex: row.currentIndex,
			livesRemaining: row.livesRemaining,
			finalTimeMs: row.finalTimeMs ?? null,
		};
	}

	async startAttempt(personId: string, date: string): Promise<AttemptState> {
		const now = new Date();
		await this.db
			.insert(dataSchema.attemptsTable)
			.values({
				id: createId(),
				personId,
				date,
				status: "playing",
				currentIndex: 0,
				livesRemaining: 5,
				wrongGuesses: 0,
				startedAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();

		await this.db
			.insert(dataSchema.dailyActivityTable)
			.values({
				id: createId(),
				personId,
				date,
				logosCorrect: 0,
				livesUsed: 0,
				completed: 0,
				updatedAt: now,
			})
			.onConflictDoNothing();

		const attempt = await this.getAttempt(personId, date);
		if (!attempt) throw new Error("Failed to start attempt");
		return attempt;
	}

	async submitGuess(personId: string, date: string, guessId: string): Promise<GuessResult> {
		const daily = await this.getDailyChallenge(date);
		if (!daily) throw new Error("Daily challenge not found");
		if (!guessId) throw new Error("guessId is required");

		let attemptRow = await this.db.query.attemptsTable.findFirst({
			where: and(
				eq(dataSchema.attemptsTable.personId, personId),
				eq(dataSchema.attemptsTable.date, date),
			),
		});

		if (!attemptRow) {
			await this.startAttempt(personId, date);
			attemptRow = await this.db.query.attemptsTable.findFirst({
				where: and(
					eq(dataSchema.attemptsTable.personId, personId),
					eq(dataSchema.attemptsTable.date, date),
				),
			});
		}

		if (!attemptRow) throw new Error("Attempt not found");

		const status = attemptRow.status as AttemptStatus;
		if (status !== "playing") {
			return {
				correct: false,
				status,
				currentIndex: attemptRow.currentIndex,
				livesRemaining: attemptRow.livesRemaining,
				finalTimeMs: attemptRow.finalTimeMs ?? null,
			};
		}

		if (attemptRow.livesRemaining <= 0) {
			return {
				correct: false,
				status: "out_of_lives",
				currentIndex: attemptRow.currentIndex,
				livesRemaining: 0,
				finalTimeMs: attemptRow.finalTimeMs ?? null,
			};
		}

		const currentIndex = attemptRow.currentIndex;
		const correctTechId = daily.techIds[currentIndex];
		if (!correctTechId) {
			throw new Error("Invalid attempt state");
		}

		const now = new Date();
		const correct = guessId === correctTechId;

		let nextStatus: AttemptStatus = "playing";
		let nextIndex = currentIndex;
		let nextLives = attemptRow.livesRemaining;
		let nextWrongGuesses = attemptRow.wrongGuesses;
		let finishedAt: Date | null = attemptRow.finishedAt ?? null;
		let finalTimeMs: number | null = attemptRow.finalTimeMs ?? null;

		if (correct) {
			nextIndex = currentIndex + 1;
			if (nextIndex >= 5) {
				nextIndex = 5;
				nextStatus = "completed";
				finishedAt = now;
				finalTimeMs = now.getTime() - attemptRow.startedAt.getTime();
			}
		} else {
			nextWrongGuesses = attemptRow.wrongGuesses + 1;
			nextLives = attemptRow.livesRemaining - 1;
			if (nextLives <= 0) {
				nextLives = 0;
				nextStatus = "out_of_lives";
				finishedAt = now;
			}
		}

		await this.db
			.update(dataSchema.attemptsTable)
			.set({
				status: nextStatus,
				currentIndex: nextIndex,
				livesRemaining: nextLives,
				wrongGuesses: nextWrongGuesses,
				...(finishedAt && { finishedAt }),
				...(finalTimeMs != null && { finalTimeMs }),
				updatedAt: now,
			})
			.where(eq(dataSchema.attemptsTable.id, attemptRow.id));

		if (correct) {
			await this.db
				.update(dataSchema.dailyActivityTable)
				.set({
					logosCorrect: sql`${dataSchema.dailyActivityTable.logosCorrect} + 1`,
					updatedAt: now,
				})
				.where(
					and(
						eq(dataSchema.dailyActivityTable.personId, personId),
						eq(dataSchema.dailyActivityTable.date, date),
					),
				);
		} else {
			await this.db
				.update(dataSchema.dailyActivityTable)
				.set({
					livesUsed: sql`${dataSchema.dailyActivityTable.livesUsed} + 1`,
					updatedAt: now,
				})
				.where(
					and(
						eq(dataSchema.dailyActivityTable.personId, personId),
						eq(dataSchema.dailyActivityTable.date, date),
					),
				);
		}

		if (nextStatus === "completed" && finalTimeMs != null) {
			const activityRow = await this.db.query.dailyActivityTable.findFirst({
				where: and(
					eq(dataSchema.dailyActivityTable.personId, personId),
					eq(dataSchema.dailyActivityTable.date, date),
				),
			});

			const shouldUpdateBest =
				!activityRow?.bestTimeMs || finalTimeMs < activityRow.bestTimeMs;

			await this.db
				.update(dataSchema.dailyActivityTable)
				.set({
					completed: 1,
					...(shouldUpdateBest && { bestTimeMs: finalTimeMs }),
					updatedAt: now,
				})
				.where(
					and(
						eq(dataSchema.dailyActivityTable.personId, personId),
						eq(dataSchema.dailyActivityTable.date, date),
					),
				);
		}

		return {
			correct,
			status: nextStatus,
			currentIndex: nextIndex,
			livesRemaining: nextLives,
			finalTimeMs,
		};
	}

	async getActivity(personId: string, days = 98): Promise<ActivityDay[]> {
		const today = getUtcDayKey();
		const start = addUtcDays(today, -(days - 1));

		const rows = await this.db.query.dailyActivityTable.findMany({
			where: and(
				eq(dataSchema.dailyActivityTable.personId, personId),
				sql`${dataSchema.dailyActivityTable.date} >= ${start}`,
				sql`${dataSchema.dailyActivityTable.date} <= ${today}`,
			),
		});

		const map = new Map(rows.map((r) => [r.date, r.logosCorrect] as const));

		const out: ActivityDay[] = [];
		for (let i = 0; i < days; i++) {
			const d = addUtcDays(start, i);
			out.push({
				date: d,
				logosCorrect: map.get(d) ?? 0,
			});
		}
		return out;
	}
}
