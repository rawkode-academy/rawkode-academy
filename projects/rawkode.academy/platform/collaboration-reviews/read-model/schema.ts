import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { GraphQLError, type GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";
import {
	type Caller,
	TRIAGE_STATES,
	authorSide,
	canComment,
	canSignOff,
	canTriageTo,
	canView,
	cleanComment,
	isAdmin,
} from "./policy";

export interface PothosTypes {
	Context: Partial<Caller>;
	// Fields are non-null unless they opt out with nullable: true.
	DefaultFieldNullability: false;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const iso = (date: Date | null) => (date ? date.toISOString() : null);

const callerOf = (context: Partial<Caller>): Caller => ({
	userId: context.userId ?? null,
	username: context.username ?? null,
	roles: context.roles ?? [],
	orgs: context.orgs ?? [],
});

const denied = () => new GraphQLError("Not allowed", { extensions: { code: "FORBIDDEN" } });
const signedOut = () => new GraphQLError("Sign in first", { extensions: { code: "UNAUTHENTICATED" } });

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
		defaultFieldNullability: false,
	});

	const ReviewState = builder.enumType("ReviewState", {
		values: ["in_review", "changes_requested", "approved", "scheduled", "published"] as const,
	});
	const CommentTriage = builder.enumType("CommentTriage", { values: TRIAGE_STATES });
	const CommentSide = builder.enumType("CommentSide", { values: ["partner", "staff"] as const });

	const requireCaller = (context: Partial<Caller>) => {
		const caller = callerOf(context);
		if (!caller.userId) throw signedOut();
		return caller;
	};
	const loadReview = async (id: string) =>
		db.select().from(s.reviewsTable).where(eq(s.reviewsTable.id, id)).get();
	const visibleReview = async (context: Partial<Caller>, id: string) => {
		const caller = requireCaller(context);
		const review = await loadReview(id);
		if (!review || !canView(caller, review)) throw new GraphQLError("Review not found");
		return { caller, review };
	};

	const CommentRef = builder.objectRef<s.ReviewComment>("ReviewComment");
	builder.objectType(CommentRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			draftVersion: t.exposeInt("draftVersion"),
			authorLogin: t.exposeString("authorLogin"),
			authorSide: t.field({ type: CommentSide, resolve: (c) => c.authorSide }),
			timestampMs: t.int({ nullable: true, resolve: (c) => c.timestampMs }),
			body: t.exposeString("body"),
			triage: t.field({ type: CommentTriage, resolve: (c) => c.triage }),
			createdAt: t.string({ resolve: (c) => c.createdAt.toISOString() }),
			// Whether the caller may change this comment's triage, and to what.
			mayWithdraw: t.boolean({
				resolve: (c, _args, context) => canTriageTo(callerOf(context), c, "withdrawn"),
			}),
		}),
	});

	const CollaboratorRef = builder.externalRef("Collaborator", builder.selection<{ id: string }>("id"));

	const ReviewRef = builder.objectRef<s.Review>("Review");
	builder.objectType(ReviewRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			collaborator: t.field({ type: CollaboratorRef, resolve: (r) => ({ id: r.collaboratorId }) }),
			videoId: t.exposeString("videoId"),
			title: t.exposeString("title"),
			videoUrl: t.exposeString("videoUrl"),
			state: t.field({ type: ReviewState, resolve: (r) => r.state }),
			draftVersion: t.exposeInt("draftVersion"),
			dueAt: t.string({ resolve: (r) => r.dueAt.toISOString() }),
			partnerApprovedBy: t.string({ nullable: true, resolve: (r) => r.partnerApprovedBy }),
			partnerApprovedAt: t.string({ nullable: true, resolve: (r) => iso(r.partnerApprovedAt) }),
			scheduledFor: t.string({ nullable: true, resolve: (r) => iso(r.scheduledFor) }),
			comments: t.field({
				type: [CommentRef],
				resolve: (r) =>
					db
						.select()
						.from(s.reviewCommentsTable)
						.where(eq(s.reviewCommentsTable.reviewId, r.id))
						.orderBy(asc(s.reviewCommentsTable.createdAt))
						.all(),
			}),
			canComment: t.boolean({ resolve: (r, _args, context) => canComment(callerOf(context), r) }),
			canSignOff: t.boolean({ resolve: (r, _args, context) => canSignOff(callerOf(context), r) }),
		}),
	});
	builder.asEntity(ReviewRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref, context) => {
			const review = await loadReview(ref.id);
			return review && canView(callerOf(context as Partial<Caller>), review) ? review : null;
		},
	});

	CollaboratorRef.implement({
		externalFields: (f) => ({ id: f.id() }),
		fields: (f) => ({
			// The reviews the caller may see for this company.
			reviews: f.field({
				type: [ReviewRef],
				resolve: async (collaborator, _args, context) => {
					const caller = callerOf(context);
					if (!caller.userId) return [];
					const rows = await db
						.select()
						.from(s.reviewsTable)
						.where(eq(s.reviewsTable.collaboratorId, collaborator.id))
						.orderBy(desc(s.reviewsTable.createdAt))
						.all();
					return rows.filter((review) => canView(caller, review));
				},
			}),
		}),
	});

	const OpenReviewInput = builder.inputType("OpenReviewInput", {
		fields: (t) => ({
			collaboratorId: t.id({ required: true }),
			organizationId: t.id({ required: true }),
			videoId: t.string({ required: true }),
			title: t.string({ required: true }),
			videoUrl: t.string({ required: true }),
			dueAt: t.string({ required: false }),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			review: t.field({
				type: ReviewRef,
				nullable: true,
				args: { id: t.arg.id({ required: true }) },
				resolve: async (_root, args, context) => {
					const caller = callerOf(context);
					if (!caller.userId) return null;
					const review = await loadReview(String(args.id));
					return review && canView(caller, review) ? review : null;
				},
			}),
			// Every review the caller may see: all of them for staff, their
			// organisations' for partners.
			reviews: t.field({
				type: [ReviewRef],
				resolve: async (_root, _args, context) => {
					const caller = callerOf(context);
					if (!caller.userId) return [];
					const rows = await db.select().from(s.reviewsTable).orderBy(desc(s.reviewsTable.createdAt)).all();
					return rows.filter((review) => canView(caller, review));
				},
			}),
		}),
	});

	builder.mutationType({
		fields: (t) => ({
			// Staff open a review for a draft, or deliver a new cut of an existing
			// one, which reopens it and clears the partner's sign-off.
			openReview: t.field({
				type: ReviewRef,
				args: { input: t.arg({ type: OpenReviewInput, required: true }) },
				resolve: async (_root, { input }, context) => {
					const caller = requireCaller(context);
					if (!isAdmin(caller)) throw denied();
					try {
						if (new URL(input.videoUrl).protocol !== "https:") throw new Error();
					} catch {
						throw new GraphQLError("The video URL must be https");
					}
					const id = `${input.collaboratorId}-${input.videoId}`;
					const dueAt = input.dueAt ? new Date(input.dueAt) : new Date(Date.now() + WEEK_MS);
					if (Number.isNaN(dueAt.getTime())) throw new GraphQLError("Invalid due date");
					const existing = await loadReview(id);
					if (existing) {
						await db
							.update(s.reviewsTable)
							.set({
								title: input.title,
								videoUrl: input.videoUrl,
								draftVersion: existing.draftVersion + 1,
								state: "in_review",
								partnerApprovedBy: null,
								partnerApprovedAt: null,
								scheduledFor: null,
								...(input.dueAt ? { dueAt } : {}),
							})
							.where(eq(s.reviewsTable.id, id));
					} else {
						await db.insert(s.reviewsTable).values({
							id,
							collaboratorId: String(input.collaboratorId),
							organizationId: String(input.organizationId),
							videoId: input.videoId,
							title: input.title,
							videoUrl: input.videoUrl,
							dueAt,
							createdAt: new Date(),
						});
					}
					return (await loadReview(id))!;
				},
			}),
			addReviewComment: t.field({
				type: CommentRef,
				args: {
					reviewId: t.arg.id({ required: true }),
					body: t.arg.string({ required: true }),
					timestampMs: t.arg.int({ required: false }),
				},
				resolve: async (_root, args, context) => {
					const { caller, review } = await visibleReview(context, String(args.reviewId));
					if (!canComment(caller, review)) throw denied();
					const cleaned = cleanComment(args.body, args.timestampMs);
					const comment: s.ReviewComment = {
						id: crypto.randomUUID(),
						reviewId: review.id,
						draftVersion: review.draftVersion,
						authorId: caller.userId!,
						authorLogin: caller.username ?? caller.userId!,
						authorSide: authorSide(caller),
						timestampMs: cleaned.timestampMs,
						body: cleaned.body,
						triage: "new",
						createdAt: new Date(),
					};
					await db.insert(s.reviewCommentsTable).values(comment);
					return comment;
				},
			}),
			triageReviewComment: t.field({
				type: CommentRef,
				args: { id: t.arg.id({ required: true }), triage: t.arg({ type: CommentTriage, required: true }) },
				resolve: async (_root, args, context) => {
					const caller = requireCaller(context);
					const comment = await db
						.select()
						.from(s.reviewCommentsTable)
						.where(eq(s.reviewCommentsTable.id, String(args.id)))
						.get();
					if (!comment) throw new GraphQLError("Comment not found");
					const review = await loadReview(comment.reviewId);
					if (!review || !canView(caller, review) || !canTriageTo(caller, comment, args.triage)) throw denied();
					await db
						.update(s.reviewCommentsTable)
						.set({ triage: args.triage })
						.where(and(eq(s.reviewCommentsTable.id, comment.id)));
					return { ...comment, triage: args.triage };
				},
			}),
			signOffReview: t.field({
				type: ReviewRef,
				args: { id: t.arg.id({ required: true }) },
				resolve: async (_root, args, context) => {
					const { caller, review } = await visibleReview(context, String(args.id));
					if (!canSignOff(caller, review)) throw denied();
					await db
						.update(s.reviewsTable)
						.set({ state: "approved", partnerApprovedBy: caller.username ?? caller.userId, partnerApprovedAt: new Date() })
						.where(eq(s.reviewsTable.id, review.id));
					return (await loadReview(review.id))!;
				},
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
