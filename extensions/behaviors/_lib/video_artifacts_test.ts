import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
	artifactState,
	artifactUrl,
	instanceRequest,
	parseKinds,
	parseList,
	planArtifact,
	selectVideos,
	storageIdentifier,
	summarize,
	type Video,
} from "./video_artifacts.ts";

const CONTENT_URL = "https://content.rawkode.academy";
const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const OPTIONS = { contentUrl: CONTENT_URL, commitSha: "abc123" };

function video(overrides: Partial<Video> = {}): Video {
	return {
		id: "video1",
		publishedAt: "2026-01-01T00:00:00.000Z",
		streamUrl: `${CONTENT_URL}/videos/video1/stream.m3u8`,
		thumbnailUrl: `${CONTENT_URL}/videos/video1/thumbnail.webp`,
		tagline: " Ship it ",
		technologies: [
			null,
			{
				id: "kubernetes",
				name: " Kubernetes ",
				icon:
					"https://content.rawkode.academy/technologies/kubernetes/icon.svg",
				terms: ["k8s"],
			},
			{ id: "helm", name: "Helm", icon: null, terms: null },
		],
		...overrides,
	};
}

Deno.test("parseList trims, drops blanks and duplicates", () => {
	assertEquals(parseList(" a, b ,,a "), ["a", "b"]);
	assertEquals(parseList(""), []);
});

Deno.test("parseKinds defaults to every kind and rejects unknown ones", () => {
	assertEquals(parseKinds(""), ["captions", "thumbnail"]);
	assertEquals(parseKinds("thumbnail"), ["thumbnail"]);
	assertEquals(parseKinds("thumbnail, captions"), ["captions", "thumbnail"]);
	assertThrows(() => parseKinds("captions,poster"), Error, "poster");
});

Deno.test("selectVideos keeps published videos, newest first", () => {
	const videos = [
		video({ id: "old", publishedAt: "2020-01-01T00:00:00.000Z" }),
		video({ id: "upcoming", publishedAt: "2027-01-01T00:00:00.000Z" }),
		video({ id: "new", publishedAt: "2026-06-01T00:00:00.000Z" }),
		video({ id: "draft", publishedAt: null }),
	];
	const { selected, absent } = selectVideos(videos, [], NOW);
	assertEquals(selected.map(({ id }) => id), ["new", "old"]);
	assertEquals(absent, []);
});

Deno.test("selectVideos narrows to requested ids and reports unknown ones", () => {
	const videos = [
		video({ id: "one" }),
		video({ id: "two" }),
		video({ id: "upcoming", publishedAt: "2027-01-01T00:00:00.000Z" }),
	];
	const { selected, absent } = selectVideos(
		videos,
		["two", "nope", "upcoming"],
		NOW,
	);
	assertEquals(selected.map(({ id }) => id), ["two"]);
	assertEquals(absent, ["nope", "upcoming"]);
});

Deno.test("storageIdentifier follows the stream URL, then the thumbnail, then the id", () => {
	assertEquals(
		storageIdentifier(
			video({ streamUrl: `${CONTENT_URL}/videos/stored/stream.m3u8` }),
		),
		"stored",
	);
	assertEquals(
		storageIdentifier(
			video({
				streamUrl: null,
				thumbnailUrl: `${CONTENT_URL}/videos/thumb/thumbnail.webp`,
			}),
		),
		"thumb",
	);
	assertEquals(
		storageIdentifier(video({ streamUrl: null, thumbnailUrl: null })),
		"video1",
	);
});

Deno.test("artifactUrl matches the paths the scripts check", () => {
	assertEquals(
		artifactUrl(`${CONTENT_URL}/`, video(), "captions"),
		"https://content.rawkode.academy/videos/video1/captions/en.vtt",
	);
	assertEquals(
		artifactUrl(CONTENT_URL, video(), "thumbnail"),
		"https://content.rawkode.academy/videos/video1/thumbnail.webp",
	);
});

Deno.test("artifactState only treats a 404 as missing", () => {
	assertEquals(artifactState(200), "present");
	assertEquals(artifactState(404), "missing");
	assertEquals(artifactState(403), "unknown");
	assertEquals(artifactState(503), "unknown");
	assertEquals(artifactState(null), "unknown");
});

Deno.test("planArtifact plans nothing for an artifact that exists", () => {
	assertEquals(planArtifact(video(), "captions", "present", OPTIONS), null);
});

Deno.test("planArtifact builds the transcription job of schedule_missing.ts", () => {
	assertEquals(planArtifact(video(), "captions", "missing", OPTIONS), {
		job: {
			videoId: "video1",
			kind: "captions",
			url: "https://content.rawkode.academy/videos/video1/captions/en.vtt",
			workflow: "transcribe",
			params: { id: "video1", language: "en" },
		},
	});
});

Deno.test("planArtifact builds the thumbnail job of trigger_missing.ts", () => {
	assertEquals(planArtifact(video(), "thumbnail", "missing", OPTIONS), {
		job: {
			videoId: "video1",
			kind: "thumbnail",
			url: "https://content.rawkode.academy/videos/video1/thumbnail.webp",
			workflow: "generate-video-thumbnail",
			params: {
				videoId: "video1",
				tagline: "Ship it",
				technology: {
					id: "kubernetes",
					name: "Kubernetes",
					iconUrl:
						"https://content.rawkode.academy/technologies/kubernetes/icon.svg",
					terms: ["k8s"],
				},
				source: { commitSha: "abc123", trigger: "manual" },
			},
		},
	});
});

Deno.test("planArtifact skips thumbnails that cannot be rendered", () => {
	const withoutTechnology = planArtifact(
		video({ technologies: [] }),
		"thumbnail",
		"missing",
		OPTIONS,
	);
	assertEquals(
		withoutTechnology && "skipped" in withoutTechnology &&
			withoutTechnology.skipped.reason,
		"missing primary technology",
	);
	const withoutIcon = planArtifact(
		video({ technologies: [{ id: "helm", icon: null }] }),
		"thumbnail",
		"missing",
		OPTIONS,
	);
	assertEquals(
		withoutIcon && "skipped" in withoutIcon && withoutIcon.skipped.reason,
		"missing technology icon for helm",
	);
});

Deno.test("planArtifact never queues a job for an unverifiable artifact", () => {
	assertEquals(
		planArtifact(video(), "captions", "unknown", {
			...OPTIONS,
			detail: "HTTP 503",
		}),
		{
			skipped: {
				videoId: "video1",
				kind: "captions",
				url: "https://content.rawkode.academy/videos/video1/captions/en.vtt",
				reason: "could not be checked (HTTP 503)",
			},
		},
	);
});

Deno.test("instanceRequest targets the Workflow instances endpoint", () => {
	assertEquals(
		instanceRequest("account", {
			workflow: "transcribe",
			params: { id: "video1", language: "en" },
		}),
		{
			url:
				"https://api.cloudflare.com/client/v4/accounts/account/workflows/transcribe/instances",
			body: '{"params":{"id":"video1","language":"en"}}',
		},
	);
});

Deno.test("summarize lists jobs by kind and what is not triggered", () => {
	assertEquals(
		summarize([], [], 12),
		"Checked 12 videos; no artifact is missing.",
	);
	const captions = planArtifact(video(), "captions", "missing", OPTIONS);
	const thumbnail = planArtifact(
		video({ id: "video2", technologies: [] }),
		"thumbnail",
		"missing",
		OPTIONS,
	);
	assertEquals(
		summarize(
			captions && "job" in captions ? [captions.job] : [],
			thumbnail && "skipped" in thumbnail ? [thumbnail.skipped] : [],
			2,
		),
		[
			"Checked 2 videos.",
			"Missing captions (1), produced by transcribe:",
			"  video1",
			"Not triggered (1):",
			"  video2 thumbnail: missing primary technology",
		].join("\n"),
	);
});
