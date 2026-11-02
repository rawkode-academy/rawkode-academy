import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import type { DocNode } from "@rawkodeacademy/rich-text";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";
import { batchLoader, chunk, groupBy } from "./batch";

export interface PothosTypes {
	Context: Record<string, unknown>;
	// Fields are non-null unless they opt out with nullable: true.
	DefaultFieldNullability: false;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		RichTextDocument: { Input: DocNode; Output: DocNode };
	};
}

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	// Created on first use, so publish.ts can build the schema without a DB.
	let client: ReturnType<typeof drizzle<typeof s>> | undefined;
	const db = () => {
		client ??= drizzle(env.DB, { schema: s });
		return client;
	};

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
		defaultFieldNullability: false,
	});
	builder.addScalarType("DateTime", DateTimeResolver);
	// A TipTap/ProseMirror JSON document (packages/rich-text). Every subgraph
	// that serves rich text declares this scalar identically, so the supergraph
	// has a single RichTextDocument type.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const r = s.releasesTable;
	const f = s.featuresTable;
	const q = s.quizQuestionsTable;

	const releaseById = (id: string) =>
		db().select().from(r).where(eq(r.id, id)).get();

	// Children of a list of releases, one query per chunk of release ids.
	const childrenOf = <T extends { releaseId: string }>(
		load: (releaseIds: string[]) => Promise<T[]>,
	) =>
		batchLoader(
			async (releaseIds: string[]) =>
				groupBy(
					(await Promise.all(chunk(releaseIds).map(load))).flat(),
					(row) => row.releaseId,
				),
			(): T[] => [],
		);
	const featuresOf = childrenOf((ids) =>
		db()
			.select()
			.from(f)
			.where(inArray(f.releaseId, ids))
			.orderBy(asc(f.sortOrder), asc(f.id))
			.all(),
	);
	const questionsOf = childrenOf((ids) =>
		db()
			.select()
			.from(q)
			.where(inArray(q.releaseId, ids))
			.orderBy(asc(q.sortOrder), asc(q.id))
			.all(),
	);

	// Types are prefixed with KubeTrack so they cannot clash with other
	// subgraphs in the supergraph.
	const StageEnum = builder.enumType("KubeTrackStage", {
		values: {
			ALPHA: { value: "alpha" },
			BETA: { value: "beta" },
			STABLE: { value: "stable" },
			DEPRECATED: { value: "deprecated" },
		} as const,
	});
	const QuestionKindEnum = builder.enumType("KubeTrackQuestionKind", {
		values: {
			SINGLE: { value: "single" },
			MULTIPLE: { value: "multiple" },
			TRUE_FALSE: { value: "true_false" },
		} as const,
	});

	const StageCountsRef = builder.objectRef<s.StageCounts>(
		"KubeTrackStageCounts",
	);
	builder.objectType(StageCountsRef, {
		fields: (t) => ({
			stable: t.exposeInt("stable"),
			beta: t.exposeInt("beta"),
			alpha: t.exposeInt("alpha"),
			deprecated: t.exposeInt("deprecated"),
		}),
	});

	const ChoiceRef = builder.objectRef<s.QuizChoice>("KubeTrackQuizChoice");
	builder.objectType(ChoiceRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			text: t.exposeString("text"),
		}),
	});

	const ReleaseRef = builder.objectRef<s.Release>("KubeTrackRelease");
	const FeatureRef = builder.objectRef<s.Feature>("KubeTrackFeature");
	const QuestionRef = builder.objectRef<s.QuizQuestion>(
		"KubeTrackQuizQuestion",
	);

	builder.objectType(ReleaseRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			major: t.exposeInt("major"),
			minor: t.exposeInt("minor"),
			title: t.exposeString("title"),
			codename: t.exposeString("codename", { nullable: true }),
			summary: t.exposeString("summary"),
			body: t.field({ type: "RichTextDocument", resolve: (x) => x.body }),
			releasedAt: t.field({ type: "DateTime", resolve: (x) => x.releasedAt }),
			// Every release is served; the website hides it until publishedAt.
			publishedAt: t.field({
				type: "DateTime",
				resolve: (x) => x.publishedAt,
			}),
			updatedAt: t.field({ type: "DateTime", resolve: (x) => x.updatedAt }),
			releaseBlogUrl: t.exposeString("releaseBlogUrl", { nullable: true }),
			changelogUrl: t.exposeString("changelogUrl", { nullable: true }),
			// The release blog's counts; the cards' counts are derived from features.
			upstreamCounts: t.field({
				type: StageCountsRef,
				nullable: true,
				resolve: (x) => x.upstreamCounts,
			}),
			features: t.field({
				type: [FeatureRef],
				resolve: (x, _args, context) => featuresOf(context, x.id),
			}),
			quizQuestions: t.field({
				type: [QuestionRef],
				resolve: (x, _args, context) => questionsOf(context, x.id),
			}),
		}),
	});

	builder.objectType(FeatureRef, {
		fields: (t) => ({
			// "<release id>/<slug>".
			id: t.exposeID("id"),
			// The card's anchor on the release page ("kep-1710").
			slug: t.exposeString("slug"),
			kep: t.exposeInt("kep"),
			title: t.exposeString("title"),
			stage: t.field({ type: StageEnum, resolve: (x) => x.stage }),
			sig: t.exposeString("sig", { nullable: true }),
			theme: t.exposeString("theme", { nullable: true }),
			featureGate: t.exposeString("featureGate", { nullable: true }),
			enabledByDefault: t.exposeBoolean("enabledByDefault", {
				nullable: true,
			}),
			previousStage: t.field({
				type: StageEnum,
				nullable: true,
				resolve: (x) => x.previousStage,
			}),
			previousStageVersion: t.exposeString("previousStageVersion", {
				nullable: true,
			}),
			summary: t.exposeString("summary"),
			body: t.field({ type: "RichTextDocument", resolve: (x) => x.body }),
			example: t.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: (x) => x.example,
			}),
			docsUrl: t.exposeString("docsUrl", { nullable: true }),
			sortOrder: t.exposeInt("sortOrder"),
		}),
	});

	builder.objectType(QuestionRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			featureId: t.exposeID("featureId", { nullable: true }),
			kind: t.field({ type: QuestionKindEnum, resolve: (x) => x.kind }),
			prompt: t.field({ type: "RichTextDocument", resolve: (x) => x.prompt }),
			choices: t.field({ type: [ChoiceRef], resolve: (x) => x.choices }),
			answerIds: t.exposeStringList("answerIds"),
			explanation: t.field({
				type: "RichTextDocument",
				resolve: (x) => x.explanation,
			}),
			sortOrder: t.exposeInt("sortOrder"),
		}),
	});

	builder.asEntity(ReleaseRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => releaseById(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			kubeTrackRelease: t.field({
				type: ReleaseRef,
				nullable: true,
				args: { id: t.arg.id({ required: true }) },
				resolve: (_root, args) => releaseById(String(args.id)),
			}),
			// Every release, newest first; the website applies publishedAt gating.
			allKubeTrackReleases: t.field({
				type: [ReleaseRef],
				resolve: () =>
					db()
						.select()
						.from(r)
						.orderBy(desc(r.major), desc(r.minor), asc(r.id))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
