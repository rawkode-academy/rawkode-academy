import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveOrgs } from "../src/directory.ts";

const collaborators = [{ id: "c1", name: "Acme" }];
const supporters = [{ id: "s1", name: "Globex" }];

test("deriveOrgs labels partner, supporter and both; drops dangling links", () => {
	const orgs = deriveOrgs(
		[
			{ orgId: "a", collaboratorId: "c1" },
			{ orgId: "b", supporterId: "s1" },
			{ orgId: "c", collaboratorId: "c1", supporterId: "s1" },
			{ orgId: "d", collaboratorId: "missing" },
		],
		collaborators,
		supporters,
	);
	assert.deepEqual(
		orgs.map((o) => [o.id, o.kind]),
		[["a", "partner"], ["b", "supporter"], ["c", "both"]],
	);
});
