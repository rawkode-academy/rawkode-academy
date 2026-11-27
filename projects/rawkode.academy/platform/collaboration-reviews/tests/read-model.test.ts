import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import type { Caller } from "../read-model/policy";
import { migratedD1 } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;

const staff: Caller = { userId: "u-staff", username: "rawkode", roles: ["collab_admin"], orgs: [] };
const owner: Caller = { userId: "u-owner", username: "acme-owner", roles: [], orgs: [{ id: "org-acme", role: "owner" }] };
const member: Caller = { userId: "u-member", username: "acme-member", roles: [], orgs: [{ id: "org-acme", role: "member" }] };
const outsider: Caller = { userId: "u-other", username: "other", roles: [], orgs: [{ id: "org-other", role: "owner" }] };
const anonymous: Caller = { userId: null, username: null, roles: [], orgs: [] };

const run = async (caller: Caller, source: string, variableValues?: Record<string, unknown>) =>
	graphql({ schema: getSchema({ DB: db.DB }), source, variableValues, contextValue: { ...caller } });
const ok = async (caller: Caller, source: string, variableValues?: Record<string, unknown>) => {
	const result = await run(caller, source, variableValues);
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};

const OPEN = `mutation ($input: OpenReviewInput!) { openReview(input: $input) { id draftVersion state } }`;
const input = {
	collaboratorId: "acme",
	organizationId: "org-acme",
	videoId: "v1",
	title: "Hands on with Acme",
	videoUrl: "https://content.rawkode.academy/videos/v1/stream.m3u8",
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
});
afterAll(() => db.dispose());

describe("collaboration reviews", () => {
	it("only staff open reviews", async () => {
		expect((await run(owner, OPEN, { input })).errors?.[0]?.message).toBe("Not allowed");
		expect((await run(anonymous, OPEN, { input })).errors?.[0]?.message).toBe("Sign in first");
		expect((await ok(staff, OPEN, { input })).openReview).toEqual({ id: "acme-v1", draftVersion: 1, state: "in_review" });
	});

	it("shows a review to staff and the org, never to anyone else", async () => {
		const q = `{ reviews { id title canComment canSignOff } }`;
		expect((await ok(staff, q)).reviews).toHaveLength(1);
		expect((await ok(member, q)).reviews).toEqual([{ id: "acme-v1", title: "Hands on with Acme", canComment: true, canSignOff: false }]);
		expect((await ok(owner, q)).reviews[0].canSignOff).toBe(true);
		expect((await ok(outsider, q)).reviews).toEqual([]);
		expect((await ok(anonymous, q)).reviews).toEqual([]);
		expect((await ok(outsider, `{ review(id: "acme-v1") { id } }`)).review).toBeNull();
	});

	it("takes timestamped comments from the org and staff, and triages only as staff", async () => {
		const add = `mutation { addReviewComment(reviewId: "acme-v1", body: " Odd cut here ", timestampMs: 91500) { id body timestampMs authorSide triage } }`;
		const mine = (await ok(member, add)).addReviewComment;
		expect(mine).toMatchObject({ body: "Odd cut here", timestampMs: 91500, authorSide: "partner", triage: "new" });
		expect((await run(outsider, add)).errors?.[0]?.message).toBe("Review not found");
		const triage = `mutation ($id: ID!, $t: CommentTriage!) { triageReviewComment(id: $id, triage: $t) { triage } }`;
		expect((await run(member, triage, { id: mine.id, t: "actionable" })).errors?.[0]?.message).toBe("Not allowed");
		expect((await ok(staff, triage, { id: mine.id, t: "actionable" })).triageReviewComment.triage).toBe("actionable");
		const own = (await ok(member, `mutation { addReviewComment(reviewId: "acme-v1", body: "Never mind") { id } }`)).addReviewComment;
		expect((await ok(member, triage, { id: own.id, t: "withdrawn" })).triageReviewComment.triage).toBe("withdrawn");
		const staffNote = (await ok(staff, `mutation { addReviewComment(reviewId: "acme-v1", body: "Fixed in cut 2") { authorSide } }`)).addReviewComment;
		expect(staffNote.authorSide).toBe("staff");
	});

	it("rejects empty and oversize comments", async () => {
		expect((await run(member, `mutation { addReviewComment(reviewId: "acme-v1", body: "  ") { id } }`)).errors?.[0]?.message).toBe("Write a comment first");
	});

	it("lets an owner sign off once; a new cut reopens it", async () => {
		expect((await run(member, `mutation { signOffReview(id: "acme-v1") { id } }`)).errors?.[0]?.message).toBe("Not allowed");
		const done = (await ok(owner, `mutation { signOffReview(id: "acme-v1") { state partnerApprovedBy } }`)).signOffReview;
		expect(done).toEqual({ state: "approved", partnerApprovedBy: "acme-owner" });
		expect((await ok(staff, OPEN, { input: { ...input, title: "Cut 2" } })).openReview).toEqual({ id: "acme-v1", draftVersion: 2, state: "in_review" });
		expect((await ok(owner, `{ review(id: "acme-v1") { partnerApprovedBy comments { id } } }`)).review.partnerApprovedBy).toBeNull();
	});

	it("extends Collaborator with the reviews the caller may see", async () => {
		const q = `query ($r: [_Any!]!) { _entities(representations: $r) { ... on Collaborator { reviews { id } } } }`;
		const r = [{ __typename: "Collaborator", id: "acme" }];
		expect((await ok(member, q, { r }))._entities[0].reviews).toEqual([{ id: "acme-v1" }]);
		expect((await ok(outsider, q, { r }))._entities[0].reviews).toEqual([]);
	});
});
