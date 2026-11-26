import assert from "node:assert/strict";
import test from "node:test";
import { composeDescription, composeTitle, MARKER, markdownToText, parseFields, renderChapters, renderFooter, trimToBytes, validateManaged, writableSnippet, type AcademyVideo } from "../src/render.ts";

const video: AcademyVideo = { id: "v1", title: "Cilium in depth", slug: "cilium-in-depth", collaborators: [], description: "First paragraph.\n\nSecond paragraph with [a link](https://example.com).", chapters: [], thumbnailUrl: "https://cdn.test/v1/thumbnail.webp" };
const bytes = (value: string) => new TextEncoder().encode(value).length;

test("the description is the header, the site's description, then the footer", () => {
  const lines = composeDescription(video).split("\n");
  assert.match(lines[0], /^Watch with chapters, code and resources: https:\/\/rawkode\.academy\/watch\/cilium-in-depth\?utm_source=youtube/);
  assert.equal(lines[2], "First paragraph.");
  assert.ok(composeDescription(video).includes("Second paragraph with a link (https://example.com)."));
  const footer = composeDescription(video).split(`${MARKER}\n`)[1];
  assert.match(footer, /^Newsletter: https:\/\/rawkode\.academy\/#join\nSupport the Academy: https:\/\/rawkode\.academy\/organizations\/support-our-work/);
});

test("a collaboration adds a disclosure line and other videos do not", () => {
  assert.doesNotMatch(renderFooter(video), /collaboration/);
  assert.match(renderFooter({ ...video, collaborators: ["Teleport"] }), /\nMade in collaboration with Teleport\.$/);
});

test("composing is deterministic and Studio text is not part of it", () => {
  assert.equal(composeDescription(video), composeDescription({ ...video }));
});

test("Markdown becomes plain text, with no angle brackets", () => {
  const text = markdownToText("## Heading\n\n**bold** and `code` and ![alt](x.png)\n\n<div>html</div> a < b\\n\\nescaped newline");
  assert.equal(text, "Heading\n\nbold and code and alt\n\nhtml a  b\n\nescaped newline");
  assert.doesNotMatch(composeDescription({ ...video, description: "x <script> y > z" }), /[<>]/);
});

test("chapters are listed only when YouTube would accept them", () => {
  const good = [{ startTime: 0, title: "Intro" }, { startTime: 65, title: "Setup" }, { startTime: 3700, title: "End" }];
  assert.equal(renderChapters(good), "Chapters\n0:00 Intro\n1:05 Setup\n1:01:40 End");
  assert.equal(renderChapters(good.slice(0, 2)), "");
  assert.equal(renderChapters([{ startTime: 5, title: "a" }, ...good.slice(1)]), "");
  assert.equal(renderChapters(good.slice(1).concat([{ startTime: 9000, title: "Last" }])), "Chapters\n0:00 Intro\n1:05 Setup\n1:01:40 End\n2:30:00 Last");
  assert.equal(renderChapters([good[0], { startTime: 4, title: "too soon" }, good[1], good[2]]), "");
  assert.match(composeDescription({ ...video, chapters: good }), /\n\nChapters\n0:00 Intro\n/);
});

test("a long description is cut cleanly, never mid-word, and always fits", () => {
  const sentence = "Kubernetes controllers reconcile desired state with observed state. ";
  const long = Array.from({ length: 120 }, () => sentence).join("") + "ending";
  const description = composeDescription({ ...video, description: long, chapters: [{ startTime: 0, title: "Intro" }, { startTime: 30, title: "Two" }, { startTime: 90, title: "Three" }] });
  assert.ok(bytes(description) <= 5000, `${bytes(description)} bytes`);
  const body = description.split("\n\n")[1];
  assert.ok(body.endsWith("…"));
  assert.match(body.slice(0, -1), /\.$/, "cut at a sentence");
  assert.ok(description.includes("Chapters\n0:00 Intro") && description.includes(MARKER));
  const words = "wordwordword ".repeat(600);
  const cut = trimToBytes(words, 100);
  assert.ok(bytes(cut) <= 100 && cut.endsWith("…") && /wordwordword…$/.test(cut));
});

test("multi-byte text is cut on a character boundary", () => {
  const cut = trimToBytes("é".repeat(100) + " tail", 51);
  assert.ok(bytes(cut) <= 51);
  assert.doesNotMatch(cut, /�/);
});

test("a title over the limit is cut at a word with an ellipsis", () => {
  assert.equal(composeTitle(video), "Cilium in depth");
  const long = composeTitle({ title: `${"word ".repeat(30)}end` });
  assert.ok([...long].length <= 100 && long.endsWith("…") && !/\s…$/.test(long));
  assert.equal(composeTitle({ title: "a <b> c" }), "a b c");
});

test("validation fails an empty title or an over-long description", () => {
  assert.deepEqual(validateManaged({ title: "ok", description: "ok" }), []);
  assert.match(validateManaged({ title: "  " })[0], /empty/);
  assert.match(validateManaged({ description: "é".repeat(2600) })[0], /5000 bytes/);
});

test("MANAGED_FIELDS defaults to everything and rejects unknown fields", () => {
  assert.deepEqual(parseFields(undefined), ["title", "description", "thumbnail"]);
  assert.deepEqual(parseFields("title, description"), ["title", "description"]);
  assert.throws(() => parseFields("tags"));
  assert.throws(() => parseFields(""));
});

test("only writable snippet fields are kept", () => {
  const snippet = writableSnippet({ title: "t", description: "d", categoryId: "28", tags: ["a"], defaultLanguage: "en", publishedAt: "x", thumbnails: {} } as never);
  assert.deepEqual(snippet, { title: "t", description: "d", categoryId: "28", tags: ["a"], defaultLanguage: "en" });
});
