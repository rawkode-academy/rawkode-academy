/**
 * Plans the transcription terms (rows of the `transcription_terms` table in
 * the `platform-transcription-terms` D1 database) that technologies and
 * people are missing, so their names are spelled correctly in transcripts.
 * D1 itself is read and written by the `@webframp/cloudflare/d1` behavior;
 * this one decides what to insert and confirms it afterwards. It only ever
 * adds terms.
 *
 * @module
 */
import { z } from "npm:zod@4";
import {
	buildStatements,
	notStored,
	parseKinds,
	split,
	summarise,
	synchronise,
	type Term,
	toEntities,
	toTerms,
} from "./_lib/transcription_terms.ts";

const TermSchema = z.object({
	kind: z.string(),
	foreignId: z.string(),
	term: z.string(),
});

const PlanSchema = z.object({
	createdAt: z.string(),
	kinds: z.array(z.string()),
	identifiers: z.array(z.string()),
	examined: z.record(z.string(), z.number()),
	missing: z.array(TermSchema),
	orphaned: z.array(TermSchema),
	statements: z.array(
		z.object({ sql: z.string(), params: z.array(z.string()) }),
	),
	summary: z.string(),
});
type Plan = z.infer<typeof PlanSchema>;

const ConfirmationSchema = z.object({
	confirmedAt: z.string(),
	terms: z.number(),
});

const RowsSchema = z.array(z.record(z.string(), z.unknown()));

interface Context {
	logger: {
		info: (message: string, properties: Record<string, unknown>) => void;
	};
	writeResource: (
		specName: string,
		name: string,
		data: Record<string, unknown>,
	) => Promise<{ name: string }>;
	readResource?: (name: string) => Promise<Record<string, unknown> | null>;
}

function label(term: Term): string {
	return `${term.kind} ${term.foreignId} "${term.term}"`;
}

/** Behavior definition for synchronising transcription terms with names. */
export const behavior = {
	type: "@rawkode/academy/transcription-terms",
	version: "2026.11.11.1",
	resources: {
		plan: {
			description:
				"The terms the latest plan wants inserted, and the orphaned terms it found",
			schema: PlanSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
		confirmation: {
			description: "Proof that the planned terms are stored in D1",
			schema: ConfirmationSchema,
			lifetime: "infinite" as const,
			garbageCollection: 20,
		},
	},
	methods: {
		plan: {
			description:
				"Compare the names of technologies and people with the stored transcription terms and plan the inserts for the ones that are missing; orphaned terms are reported, never removed",
			arguments: z.object({
				technologies: RowsSchema
					.describe("Every row of the technologies table: id, name, aliases"),
				people: RowsSchema
					.describe(
						"Every row of the people table: id, name, forename, surname",
					),
				terms: RowsSchema
					.describe(
						"The stored transcription_terms rows: kind, foreignId, term",
					),
				kinds: z.string().default("")
					.describe(
						"Comma-separated kinds to synchronise (technology, person); empty covers both",
					),
				identifiers: z.string().default("")
					.describe(
						"Comma-separated technology or person ids to synchronise; empty covers every row of the kinds",
					),
			}),
			execute: async (
				args: {
					technologies: Array<Record<string, unknown>>;
					people: Array<Record<string, unknown>>;
					terms: Array<Record<string, unknown>>;
					kinds: string;
					identifiers: string;
				},
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const kinds = parseKinds(args.kinds);
				const identifiers = [...new Set(split(args.identifiers))];
				const synchronisation = synchronise(
					[
						...toEntities("technology", args.technologies),
						...toEntities("person", args.people),
					],
					toTerms(args.terms),
					kinds,
					identifiers,
				);
				if (synchronisation.unknown.length > 0) {
					throw new Error(
						`No ${kinds.join(" or ")} row for: ${
							synchronisation.unknown.join(", ")
						}`,
					);
				}
				const statements = buildStatements(synchronisation.missing);
				const handle = await context.writeResource("plan", "plan", {
					createdAt: new Date().toISOString(),
					kinds,
					identifiers,
					examined: synchronisation.examined,
					missing: synchronisation.missing,
					orphaned: synchronisation.orphaned,
					statements,
					summary: summarise(synchronisation),
				});
				context.logger.info(
					"Planned {missing} terms in {statements} statements; {orphaned} orphaned",
					{
						missing: synchronisation.missing.length,
						statements: statements.length,
						orphaned: synchronisation.orphaned.length,
					},
				);
				return { dataHandles: [handle] };
			},
		},
		confirm: {
			description:
				"Compare freshly read transcription terms with the latest plan and fail unless every planned term is stored",
			arguments: z.object({
				terms: RowsSchema
					.describe(
						"The transcription_terms rows read after the write: kind, foreignId, term",
					),
			}),
			execute: async (
				args: { terms: Array<Record<string, unknown>> },
				context: Context,
			): Promise<{ dataHandles: Array<{ name: string }> }> => {
				const plan = await context.readResource!("plan") as Plan | null;
				if (!plan) throw new Error("No plan to confirm: run plan first");
				const absent = notStored(plan.missing, toTerms(args.terms));
				if (absent.length > 0) {
					throw new Error(
						`${absent.length} of ${plan.missing.length} planned terms are not stored, starting with: ${
							absent.slice(0, 10).map(label).join(", ")
						}`,
					);
				}
				const handle = await context.writeResource(
					"confirmation",
					"confirmation",
					{
						confirmedAt: new Date().toISOString(),
						terms: plan.missing.length,
					},
				);
				return { dataHandles: [handle] };
			},
		},
	},
};
