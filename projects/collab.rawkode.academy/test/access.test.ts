import assert from "node:assert/strict";
import { test } from "node:test";
import {
	canComment,
	canSeeReview,
	canSignOff,
	canTriageTo,
	formatTimestamp,
	parseNewComment,
	reviewsVisible,
	scopeFor,
} from "../src/access.ts";
import { principalFromClaims } from "../src/auth.ts";
import { previewPersonas, seedComments, seedOrgs, seedReviews } from "../src/seed.ts";
import type { Principal, Session } from "../src/types.ts";

const persona = (key: string): Principal => previewPersonas.find((p) => p.key === key)!.principal;
const session = (principal: Principal, viewAs?: Session["viewAs"]): Session => ({
	principal,
	viewAs,
	expiresAt: Date.now() + 1000,
});
const review = seedReviews[0];

test("a partner sees only their own organisation's reviews", () => {
	const scope = scopeFor(session(persona("partner-owner")), seedOrgs);
	assert.equal(reviewsVisible(scope, seedOrgs, seedReviews).length, 1);
	const other = { ...review, orgId: "globex-db" };
	assert.equal(canSeeReview(scope, seedOrgs, other), false);
});

test("a supporter has no draft review", () => {
	const scope = scopeFor(session(persona("supporter")), seedOrgs);
	assert.equal(scope.persona, "supporter");
	assert.equal(reviewsVisible(scope, seedOrgs, seedReviews).length, 0);
	assert.equal(canSeeReview(scope, seedOrgs, { ...review, orgId: "globex-db" }), false);
});

test("an admin sees everything and may triage", () => {
	const scope = scopeFor(session(persona("david")), seedOrgs);
	assert.equal(scope.persona, "staff");
	assert.equal(scope.canTriage, true);
	assert.equal(canSeeReview(scope, seedOrgs, review), true);
});

test("view as shows exactly one organisation, read-only, and cannot write", () => {
	const david = persona("david");
	const scope = scopeFor(session(david, { orgId: "acme-cloud", persona: "partner" }), seedOrgs);
	assert.equal(scope.readOnly, true);
	assert.equal(scope.canTriage, false);
	assert.equal(canSeeReview(scope, seedOrgs, review), true);
	assert.equal(canComment(scope, review), false);
	assert.equal(canSignOff(scope, david, review), false);
	assert.equal(canTriageTo(scope, david, seedComments[0], "actionable"), false);
	assert.deepEqual(scope.banner, { orgName: seedOrgs[0].name, persona: "partner" });
});

test("view as supporter hides partner reviews", () => {
	const scope = scopeFor(session(persona("david"), { orgId: "globex-db", persona: "supporter" }), seedOrgs);
	assert.equal(reviewsVisible(scope, seedOrgs, seedReviews).length, 0);
});

test("a non-admin cannot become an admin by carrying a viewAs", () => {
	const owner = persona("partner-owner");
	const scope = scopeFor(session(owner, { orgId: "globex-db", persona: "supporter" }), seedOrgs);
	assert.equal(scope.orgIds.has("globex-db"), false);
	assert.equal(scope.readOnly, false);
});

test("only partner owners and admins can sign off; members cannot", () => {
	const owner = persona("partner-owner");
	const member = persona("partner-member");
	assert.equal(canSignOff(scopeFor(session(owner), seedOrgs), owner, review), true);
	assert.equal(canSignOff(scopeFor(session(member), seedOrgs), member, review), false);
	assert.equal(canSignOff(scopeFor(session(owner), seedOrgs), owner, { ...review, state: "approved" }), false);
});

test("comments close once a review is scheduled", () => {
	const scope = scopeFor(session(persona("partner-owner")), seedOrgs);
	assert.equal(canComment(scope, review), true);
	assert.equal(canComment(scope, { ...review, state: "scheduled" }), false);
});

test("only staff triage; a partner may only withdraw their own new comment", () => {
	const owner = persona("partner-owner");
	const partnerScope = scopeFor(session(owner), seedOrgs);
	const own = seedComments[1];
	assert.equal(canTriageTo(partnerScope, owner, own, "actionable"), false);
	assert.equal(canTriageTo(partnerScope, owner, own, "withdrawn"), true);
	assert.equal(canTriageTo(partnerScope, owner, { ...own, authorLogin: "someone-else" }, "withdrawn"), false);
	const david = persona("david");
	assert.equal(canTriageTo(scopeFor(session(david), seedOrgs), david, own, "not_actionable"), true);
	assert.equal(canTriageTo(scopeFor(session(david), seedOrgs), david, own, "withdrawn"), false);
});

test("parseNewComment validates the body and the timestamp", () => {
	assert.deepEqual(parseNewComment({ body: " hi ", timestampMs: 1500.4 }), { ok: true, timestampMs: 1500, body: "hi" });
	assert.deepEqual(parseNewComment({ body: "general" }), { ok: true, timestampMs: null, body: "general" });
	assert.equal(parseNewComment({ body: "   " }).ok, false);
	assert.equal(parseNewComment({ body: "x", timestampMs: -1 }).ok, false);
	assert.equal(parseNewComment({ body: "x", timestampMs: "1" }).ok, false);
	assert.equal(parseNewComment({ body: "x".repeat(2001) }).ok, false);
	assert.equal(parseNewComment({ body: "x", timestampMs: 100_000 }, 10_000).ok, false);
	assert.equal(parseNewComment(null).ok, false);
});

test("formatTimestamp", () => {
	assert.equal(formatTimestamp(0), "0:00");
	assert.equal(formatTimestamp(65_000), "1:05");
	assert.equal(formatTimestamp(3_725_000), "1:02:05");
});

test("principalFromClaims reads GitHub login, admin role and organisations; never email", () => {
	const principal = principalFromClaims({
		sub: "u1",
		username: "octocat",
		name: "Octo Cat",
		email: "private@example.com",
		"https://rawkode.academy/roles": ["collab_admin"],
		"https://rawkode.academy/orgs": [
			{ id: "o1", role: "owner" },
			{ id: "o2", role: "root" },
			{ nope: true },
		],
	});
	assert.deepEqual(principal, {
		userId: "u1",
		login: "octocat",
		name: "Octo Cat",
		admin: true,
		orgs: [{ orgId: "o1", role: "owner" }],
	});
	assert.equal(JSON.stringify(principal).includes("private@example.com"), false);
	assert.equal(principalFromClaims({ sub: "u1" }), null);
	assert.equal(principalFromClaims({ username: "x" }), null);
	assert.equal(principalFromClaims({ sub: "u", username: "x" })?.admin, false);
});
