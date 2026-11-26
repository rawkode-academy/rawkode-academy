import test from "node:test";
import assert from "node:assert/strict";
import { fetchAcademyVideos, guestDailySql, normalizeHandle, normalizeTitle, visibleEpisodes, youtubeIds, type AcademyVideo } from "../src/guest.ts";
import { readOnlyStatement } from "../src/basin.ts";

const video = (id: string, title: string, extra: Partial<AcademyVideo> = {}): AcademyVideo => ({ id, title, slug: id, publishedAt: null, youtubeId: null, show: null, guests: [], hosts: [], ...extra });
const who = (id: string, githubHandle: string | null = null) => ({ id, githubHandle });

test("handles are matched with the Academy's own normalisation", () => {
  assert.equal(normalizeHandle(" Ice_Puma "), "ice-puma");
  assert.equal(normalizeHandle("--"), "");
});

test("guests see their videos, hosts see every episode of their show, everyone else sees nothing", () => {
  const videos = [
    video("a", "A", { guests: [who("icepuma")], show: "oh", hosts: [who("rawkode", "rawkode")] }),
    video("b", "B", { guests: [who("someone", "IcePuma")], show: "oh", hosts: [who("rawkode")] }),
    video("c", "C", { guests: [who("other")], show: "oh", hosts: [who("rawkode")] }),
    video("d", "D", { guests: [], show: "mine", hosts: [who("x", "icepuma")] }),
    video("e", "E", { guests: [who("icepuma")], show: "mine", hosts: [who("x", "icepuma")] }),
    video("f", "F"),
  ];
  assert.deepEqual(visibleEpisodes(videos, "icepuma").map(e => [e.id, e.role]), [["a", "guest"], ["b", "guest"], ["d", "host"], ["e", "guest"]]);
  assert.deepEqual(visibleEpisodes(videos, "rawkode").map(e => e.id), ["a", "b", "c"]);
  assert.deepEqual(visibleEpisodes(videos, "nobody"), []);
  assert.deepEqual(visibleEpisodes(videos, "--"), [], "a username with no letters matches nobody");
  assert.ok(!("guests" in visibleEpisodes(videos, "icepuma")[0]), "other people aren't exposed");
});

test("casting credits decide who was on a video; videos without credits keep the show's hosts", async () => {
  const credited = { id: "c", title: "C", slug: "c", publishedAt: null, youtubeId: null, guests: [{ id: "legacy-guest" }], castingCredits: [{ role: "HOST", person: { id: "rawkode" } }, { role: "GUEST", person: { id: "icepuma" } }], episode: { show: { id: "cnc", hosts: [{ id: "rawkode" }, { id: "nimbinatus" }] } } };
  const legacy = { id: "l", title: "L", slug: "l", publishedAt: null, youtubeId: null, guests: [], episode: { show: { id: "cnc", hosts: [{ id: "rawkode" }, { id: "nimbinatus" }] } } };
  const videos = await fetchAcademyVideos((async () => Response.json({ data: { getAllVideos: [credited, legacy], allCourses: [] } })) as unknown as typeof fetch);
  assert.deepEqual(videos.map(v => [v.id, v.guests.map(p => p.id), v.hosts.map(p => p.id)]), [["c", ["icepuma"], ["rawkode"]], ["l", [], ["rawkode", "nimbinatus"]]]);
  assert.deepEqual(visibleEpisodes(videos, "nimbinatus").map(e => e.id), ["l"], "a co-host who was not credited on an episode does not see it");
});

test("YouTube IDs come from the stored ID, else from a title that is unique on both sides", () => {
  assert.equal(normalizeTitle("  Café: Intar — Office Hours! "), "cafe intar office hours");
  const videos = [
    video("stored", "Whatever", { youtubeId: "AAAAAAAAAAA" }),
    video("unique", "Intar Office Hours"),
    video("dup1", "Weekly"), video("dup2", "weekly"),
    video("lakedup", "Twice"),
    video("none", "Not on YouTube"),
    video("claimed", "Claimed title"),
    video("bad", "Bad id", { youtubeId: "short" }),
  ];
  const lake = [
    { video: "CCCCCCCCCCC", title: "intar office hours" },
    { video: "DDDDDDDDDDD", title: "Weekly" },
    { video: "EEEEEEEEEEE", title: "Twice" }, { video: "FFFFFFFFFFF", title: "Twice" },
    { video: "AAAAAAAAAAA", title: "Claimed title" },
    { video: "GGGGGGGGGGG", title: "Bad id" },
  ];
  const ids = youtubeIds(videos, lake);
  assert.equal(ids.get("stored"), "AAAAAAAAAAA");
  assert.equal(ids.get("unique"), "CCCCCCCCCCC");
  assert.equal(ids.get("dup1"), undefined, "a title shared by two Academy videos is ambiguous");
  assert.equal(ids.get("lakedup"), undefined, "a title shared by two YouTube videos is ambiguous");
  assert.equal(ids.get("none"), undefined);
  assert.equal(ids.get("claimed"), undefined, "a YouTube video already tied to another Academy video isn't reused");
  assert.equal(ids.get("bad"), "GGGGGGGGGGG", "an invalid stored ID falls back to the title");
});

test("the daily query is built only from valid YouTube IDs and stays read-only", () => {
  const sql = guestDailySql(["AAAAAAAAAAA", "b-_Bb-_Bb-_"], "2026-01-01", "2026-01-31");
  assert.match(sql, /IN \('AAAAAAAAAAA', 'b-_Bb-_Bb-_'\)/);
  assert.match(sql, /event_type = 'youtube\.video_daily'/);
  assert.match(sql, /CAST\(json_as_text\(value, 'data', 'likes'\) AS BIGINT\) AS likes/);
  assert.ok(readOnlyStatement(sql));
  for (const bad of ["x", "AAAAAAAAAA'", "AAAAAAAAAA' OR '1'='1", "AAAAAAAAAAAA"]) assert.throws(() => guestDailySql([bad], "2026-01-01", "2026-01-31"), { code: "invalid_input" });
  assert.throws(() => guestDailySql([], "2026-01-01", "2026-01-31"), { code: "invalid_input" });
});

test("the Academy video list is read from GraphQL and an unusable answer is refused", async () => {
  let sent: { url: string; body: string } | undefined;
  const good = (async (url: string, init: RequestInit) => {
    sent = { url, body: init.body as string };
    return Response.json({ data: { getAllVideos: [{ id: "v", title: "T", slug: "t", publishedAt: "2026-01-02T03:04:05.000Z", youtubeId: null, guests: [{ id: "icepuma", githubHandle: "icepuma" }], episode: { show: { id: "oh", hosts: [{ id: "rawkode", githubHandle: null }] } } }, { id: "w", title: "W", slug: "w", publishedAt: null, youtubeId: null, guests: [], episode: null }], allCourses: [{ authors: [{ id: "teacher", githubHandle: null }], modules: [{ video: { id: "w" } }, { video: null }] }] } });
  }) as unknown as typeof fetch;
  const videos = await fetchAcademyVideos(good);
  assert.equal(sent!.url, "https://api.rawkode.academy/");
  assert.match(JSON.parse(sent!.body).query, /getAllVideos/);
  assert.deepEqual(videos.map(v => [v.id, v.show, v.guests.length, v.hosts.length, v.publishedAt]), [["v", "oh", 1, 1, "2026-01-02T03:04:05.000Z"], ["w", null, 0, 1, null]]);
  assert.deepEqual(videos[1].hosts, [{ id: "teacher", githubHandle: null }]);
  for (const bad of [Response.json({ errors: [{ message: "x" }] }), Response.json({ data: { getAllVideos: [{ id: 1 }] } }), new Response("oops", { status: 502 })]) {
    await assert.rejects(fetchAcademyVideos((async () => bad) as unknown as typeof fetch), { code: "academy_api_unavailable" });
  }
});
