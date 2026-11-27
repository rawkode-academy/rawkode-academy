import assert from "node:assert/strict";
import { test } from "node:test";
import { principalFromClaims } from "../src/lib/auth.ts";
import { formatTimestamp } from "../src/lib/format.ts";
import { scopeFor, sees } from "../src/lib/scope.ts";
import type { Session } from "../src/lib/types.ts";

const claims = {
	sub: "u1",
	username: "octocat",
	name: "Mona",
	email: "never-read@example.com",
	"https://rawkode.academy/roles": ["collab_admin"],
	"https://rawkode.academy/orgs": [
		{ id: "collab-acme", role: "owner" },
		{ id: "bad", role: "emperor" },
		{ role: "owner" },
	],
};

test("principalFromClaims reads login, admin role and valid organisations; never email", () => {
	const principal = principalFromClaims(claims)!;
	assert.equal(principal.login, "octocat");
	assert.equal(principal.admin, true);
	assert.deepEqual(principal.orgs, [{ orgId: "collab-acme", role: "owner" }]);
	assert.equal("email" in principal, false);
	assert.equal(principalFromClaims({ sub: "u1" }), null);
	assert.equal(principalFromClaims({ ...claims, "https://rawkode.academy/roles": [] })!.admin, false);
});

const session = (admin: boolean, viewAs?: string): Session => ({
	principal: { userId: "u", login: "l", name: "n", admin, orgs: [{ orgId: "collab-acme", role: "member" }] },
	accessToken: "t",
	expiresAt: Date.now() + 1000,
	viewAs: viewAs ? { orgId: viewAs, kind: "partner" } : undefined,
});

test("a partner sees only their organisations and cannot triage", () => {
	const scope = scopeFor(session(false));
	assert.equal(sees(scope, "collab-acme"), true);
	assert.equal(sees(scope, "collab-other"), false);
	assert.equal(sees(scope, null), false);
	assert.equal(scope.canTriage, false);
});

test("staff see everything and act; view-as narrows to one organisation, read-only", () => {
	const staff = scopeFor(session(true));
	assert.equal(sees(staff, "collab-other"), true);
	assert.equal(staff.canTriage, true);
	const viewing = scopeFor(session(true, "collab-globex"));
	assert.equal(sees(viewing, "collab-globex"), true);
	assert.equal(sees(viewing, "collab-acme"), false);
	assert.equal(viewing.readOnly, true);
	assert.equal(viewing.canTriage, false);
});

test("formatTimestamp", () => {
	assert.equal(formatTimestamp(0), "0:00");
	assert.equal(formatTimestamp(91500), "1:31");
	assert.equal(formatTimestamp(3_725_000), "1:02:05");
});
