import assert from "node:assert/strict";
import test from "node:test";
import { composeDescription, composeTitle, https, MARKER, markdownToText, parseFields, renderChapters, renderFooter, renderHashtags, renderMetadata, trimToBytes, validateManaged, writableSnippet, type AcademyVideo } from "../src/render.ts";

const video: AcademyVideo = { id: "v1", title: "Cilium in depth", slug: "cilium-in-depth", collaborators: [], description: "First paragraph.\n\nSecond paragraph with [a link](https://example.com).", chapters: [], thumbnailUrl: "https://cdn.test/v1/thumbnail.webp", show: null, guests: [], technologies: [] };
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
  // YouTube rejects angle brackets, so every one is removed.
  assert.equal(text, "Heading\n\nbold and code and alt\n\ndivhtml/div a  b\n\nescaped newline");
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

test("a title carries its show or course as a suffix, kept whole", () => {
  assert.equal(composeTitle({ title: "22. Borko Vs. Bojan", show: { id: "klustered", name: "Klustered" } }), "22. Borko Vs. Bojan | Klustered");
  assert.equal(composeTitle({ title: "Intro", course: "Teleport for Kubernetes" }), "Intro | Teleport for Kubernetes");
  assert.equal(composeTitle({ title: "Already | Klustered", show: { id: "k", name: "Klustered" } }), "Already | Klustered");
  const long = composeTitle({ title: `${"word ".repeat(30)}end`, show: { id: "k", name: "Klustered" } });
  assert.ok([...long].length <= 100 && long.endsWith("… | Klustered"));
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

const rich: AcademyVideo = {
  ...video, show: { id: "rawkode-live", name: "Rawkode Live" },
  guests: [{ id: "ellie", name: "Ellie Huxtable", x: "https://x.com/ellie_huxtable", bluesky: "https://bsky.app/profile/ellie.wtf", linkedin: "https://www.linkedin.com/in/elliehuxtable" }, { id: "nobody", name: "No Socials" }],
  technologies: [{ id: "atuin", name: "Atuin", website: "https://atuin.sh", x: "https://twitter.com/atuinsh", bluesky: "https://bsky.app/profile/atuin.sh", mastodon: "https://hachyderm.io/@atuin" }],
};

test("the show, guests and technologies are one compact line each, with https links", () => {
  assert.equal(renderMetadata({ ...rich, technologies: [{ ...rich.technologies[0], youtube: "https://youtube.com/@atuinsh" }] }), [
    "🎬 Rawkode Live · https://rawkode.academy/shows/rawkode-live",
    "👥 Guests\nEllie Huxtable · https://rawkode.academy/people/ellie · https://x.com/ellie_huxtable\nNo Socials · https://rawkode.academy/people/nobody",
    "🧩 Technologies\nAtuin · https://rawkode.academy/technology/atuin · @atuinsh",
  ].join("\n\n"));
  assert.equal(renderMetadata(rich).split("\n").pop(), "Atuin · https://rawkode.academy/technology/atuin");
  assert.equal(renderMetadata(video), "");
});

test("up to three hashtags: the show, then the technologies", () => {
  assert.equal(renderHashtags(rich), "#RawkodeLive #Atuin");
  assert.equal(renderHashtags({ show: null, technologies: ["A b", "C", "D", "E"].map((name, i) => ({ id: `t${i}`, name })) }), "#Ab #C #D");
  assert.equal(renderHashtags(video), "");
});

test("links are upgraded to https, handles expanded, junk dropped", () => {
  assert.equal(https("http://atuin.sh"), "https://atuin.sh");
  assert.equal(https("@atuinsh", "https://x.com/"), "https://x.com/atuinsh");
  assert.equal(https("not a url"), undefined);
  assert.equal(https(null), undefined);
  assert.doesNotMatch(composeDescription(rich), /http:\/\//);
});

test("the metadata sits after the chapters and before the footer, and the body is trimmed before it", () => {
  const long = Array.from({ length: 150 }, () => "Kubernetes controllers reconcile desired state with observed state. ").join("");
  const description = composeDescription({ ...rich, description: long, chapters: [{ startTime: 0, title: "Intro" }, { startTime: 30, title: "Two" }, { startTime: 90, title: "Three" }] });
  assert.ok(bytes(description) <= 5000);
  const order = ["Watch with chapters", "…", "Chapters\n", "🎬 Rawkode Live", "👥 Guests\n", "🧩 Technologies\n", MARKER].map(part => description.indexOf(part));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(description, /\n#RawkodeLive #Atuin$/);
});

test("an enormous guest list is capped and the description still fits", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `g${i}`, name: `Guest ${i}`, x: `https://x.com/g${i}`.padEnd(400, "x") }));
  const description = composeDescription({ ...rich, guests: many, technologies: many.map(g => ({ id: g.id, name: g.name, website: g.x })) });
  assert.ok(bytes(description) <= 5000);
  assert.ok(description.includes(MARKER));
});
