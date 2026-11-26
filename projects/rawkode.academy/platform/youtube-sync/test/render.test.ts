import assert from "node:assert/strict";
import test from "node:test";
import { composeDescription, descriptionBody, MARKER, parseFields, renderFooter, validateManaged, writableSnippet } from "../src/render.ts";

const video = { id: "v1", title: "Cilium in depth", slug: "cilium-in-depth", collaborators: [] as string[] };

test("the footer carries the watch, newsletter and supporter links, with the watch link first", () => {
  const footer = renderFooter(video).split("\n");
  assert.equal(footer[0], MARKER);
  assert.match(footer[1], /^Watch with chapters, code and resources: https:\/\/rawkode\.academy\/watch\/cilium-in-depth\?utm_source=youtube/);
  assert.ok(footer.some(line => line === "Newsletter: https://rawkode.academy/#join"));
  assert.ok(footer.some(line => line.startsWith("Support the Academy: https://rawkode.academy/organizations/support-our-work")));
});

test("a collaboration adds a disclosure line and other videos do not", () => {
  assert.doesNotMatch(renderFooter(video), /collaboration/);
  assert.match(renderFooter({ ...video, collaborators: ["Teleport"] }), /\nMade in collaboration with Teleport\.$/);
});

test("only the footer is replaced; text written in Studio above it is kept", () => {
  const live = `Written in Studio.\n\nSecond paragraph.\n\n${MARKER}\nold footer line\nanother`;
  const description = composeDescription(live, video);
  assert.ok(description.startsWith("Written in Studio.\n\nSecond paragraph.\n\n" + MARKER));
  assert.doesNotMatch(description, /old footer line/);
  assert.equal(descriptionBody(description), "Written in Studio.\n\nSecond paragraph.");
});

test("composing is idempotent", () => {
  const once = composeDescription("Hello", video);
  assert.equal(composeDescription(once, video), once);
  assert.equal(composeDescription("", video), renderFooter(video));
});

test("CRLF descriptions from Studio are handled", () => {
  assert.equal(descriptionBody(`a\r\nb\r\n${MARKER}\r\nx`), "a\nb");
});

test("validation fails the item instead of truncating", () => {
  assert.deepEqual(validateManaged({ title: "ok", description: "ok" }), []);
  assert.match(validateManaged({ title: "x".repeat(101) })[0], /over 100/);
  assert.match(validateManaged({ title: "a <b>" })[0], /< or >/);
  assert.match(validateManaged({ description: "é".repeat(2600) })[0], /5000 bytes/);
  assert.match(validateManaged({ title: "  " })[0], /empty/);
});

test("MANAGED_FIELDS defaults to the description and rejects unknown fields", () => {
  assert.deepEqual(parseFields(undefined), ["description"]);
  assert.deepEqual(parseFields("title, description"), ["title", "description"]);
  assert.throws(() => parseFields("tags"));
  assert.throws(() => parseFields(""));
});

test("only writable snippet fields are kept", () => {
  const snippet = writableSnippet({ title: "t", description: "d", categoryId: "28", tags: ["a"], defaultLanguage: "en", publishedAt: "x", thumbnails: {} } as never);
  assert.deepEqual(snippet, { title: "t", description: "d", categoryId: "28", tags: ["a"], defaultLanguage: "en" });
});
