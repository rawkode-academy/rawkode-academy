import assert from "node:assert/strict";
import { test } from "node:test";
import { applyIngest, parseIngest, tokenMatches } from "../src/ingest.ts";

const ok = { orgId: "acme", videoId: "v1", title: " Hands on ", videoUrl: "https://cdn.example/v1.mp4" };

test("parseIngest accepts valid payloads and rejects bad ones", () => {
	assert.equal(parseIngest(ok)?.title, "Hands on");
	assert.equal(parseIngest({ ...ok, videoUrl: "http://x/y.mp4" }), null);
	assert.equal(parseIngest({ ...ok, orgId: "../x" }), null);
	assert.equal(parseIngest({ ...ok, dueAt: "nope" }), null);
	assert.equal(parseIngest(null), null);
});

test("applyIngest creates, then bumps the cut and clears sign-off", () => {
	const now = new Date("2026-11-27T00:00:00Z");
	const first = applyIngest(null, parseIngest(ok)!, now);
	assert.equal(first.draftVersion, 1);
	assert.equal(first.dueAt, "2026-12-04T00:00:00.000Z");
	const signed = { ...first, state: "approved" as const, partnerApprovedBy: "x", partnerApprovedAt: "t", scheduledFor: "s" };
	const second = applyIngest(signed, parseIngest(ok)!, now);
	assert.equal(second.draftVersion, 2);
	assert.equal(second.state, "in_review");
	assert.equal(second.partnerApprovedBy, undefined);
});

test("tokenMatches needs the exact bearer secret", () => {
	assert.equal(tokenMatches("Bearer s3cret", "s3cret"), true);
	assert.equal(tokenMatches("Bearer s3cre", "s3cret"), false);
	assert.equal(tokenMatches("s3cret", "s3cret"), false);
	assert.equal(tokenMatches("Bearer ", undefined), false);
});
