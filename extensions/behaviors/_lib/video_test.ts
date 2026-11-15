import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
	evaluate,
	failureMessage,
	firstMissing,
	type Observations,
	parseImporterState,
	parseYouTubeId,
	stageUrls,
} from "./video.ts";

const CONTENT = "https://content.example";
const urls = stageUrls(CONTENT, "abc");

function observed(
	overrides: Partial<Observations> = {},
	statuses: Record<string, number | null> = {},
): Observations {
	return {
		youtubeId: null,
		videoId: "abc",
		resolution: "given as the video id",
		importerState: null,
		requireImporterState: false,
		video: { id: "abc", title: "A Video" },
		apiUrl: "https://api.example",
		probes: Object.values(urls).flat().map((url) => ({
			url,
			status: url in statuses ? statuses[url] : 200,
		})),
		...overrides,
	};
}

Deno.test("parseYouTubeId accepts ids and the usual URLs", () => {
	assertEquals(parseYouTubeId("tKc8Rna3vDQ"), "tKc8Rna3vDQ");
	assertEquals(
		parseYouTubeId("https://www.youtube.com/watch?v=tKc8Rna3vDQ&t=10s"),
		"tKc8Rna3vDQ",
	);
	assertEquals(parseYouTubeId("https://youtu.be/tKc8Rna3vDQ"), "tKc8Rna3vDQ");
	assertEquals(
		parseYouTubeId("https://youtube.com/live/tKc8Rna3vDQ?feature=share"),
		"tKc8Rna3vDQ",
	);
	assertEquals(parseYouTubeId("https://example.com/watch?v=tKc8Rna3vDQ"), null);
	assertEquals(parseYouTubeId("not an id"), null);
});

Deno.test("parseImporterState reads the cuid and the completed steps", () => {
	assertEquals(
		parseImporterState(
			'{"cuid":"abc","completed_steps":["video_downloaded","completed"]}',
		),
		{ videoId: "abc", completedSteps: ["video_downloaded", "completed"] },
	);
	assertEquals(parseImporterState('{"cuid":null}'), {
		videoId: null,
		completedSteps: [],
	});
	assertEquals(parseImporterState("not json"), null);
});

Deno.test("stageUrls names the artifacts of each stage", () => {
	assertEquals(urls, {
		upload: [
			"https://content.example/videos/abc/original.mkv",
			"https://content.example/videos/abc/original.mp3",
			"https://content.example/videos/abc/thumbnail.webp",
		],
		transcoding: ["https://content.example/videos/abc/stream.m3u8"],
		transcription: ["https://content.example/videos/abc/captions/en.vtt"],
	});
});

Deno.test("every stage is evidenced when everything answers", () => {
	const stages = evaluate(observed(), CONTENT);
	assertEquals(stages.map((stage) => stage.evidenced), [
		true,
		true,
		true,
		true,
	]);
	assertEquals(firstMissing(stages), null);
});

Deno.test("a triggered but unfinished transcode is not evidence", () => {
	const stages = evaluate(
		observed({
			youtubeId: "tKc8Rna3vDQ",
			importerState: {
				videoId: "abc",
				completedSteps: ["cloud_run_triggered", "d1_written", "completed"],
			},
		}, { [urls.transcoding[0]]: 404, [urls.transcription[0]]: 404 }),
		CONTENT,
	);
	const missing = firstMissing(stages)!;
	assertEquals(missing.name, "transcoding");
	assertEquals(
		failureMessage(missing).startsWith(
			"Stage `transcoding` is not evidenced: https://content.example/videos/abc/stream.m3u8 answered 404.",
		),
		true,
	);
	assertEquals(firstMissing(stages, "video"), null);
});

Deno.test("an upload without the importer's `completed` is not done", () => {
	const stages = evaluate(
		observed({
			youtubeId: "tKc8Rna3vDQ",
			importerState: {
				videoId: "abc",
				completedSteps: ["video_uploaded_content"],
			},
		}),
		CONTENT,
	);
	assertEquals(stages[0].missing, [
		"importer state for tKc8Rna3vDQ lacks `completed`",
	]);
	assertEquals(stages[1].missing, [
		"importer state for tKc8Rna3vDQ lacks `d1_written`",
	]);
});

Deno.test("absent importer state only fails when it is required", () => {
	assertEquals(firstMissing(evaluate(observed(), CONTENT)), null);
	const stages = evaluate(
		observed({ youtubeId: "tKc8Rna3vDQ", requireImporterState: true }),
		CONTENT,
	);
	assertEquals(stages[0].missing, [
		"no importer state for tKc8Rna3vDQ on this machine",
	]);
});

Deno.test("an unresolved video fails at the first stage", () => {
	const stages = evaluate(
		observed({
			videoId: null,
			video: null,
			probes: [],
			resolution: "no video for YouTube id tKc8Rna3vDQ",
		}),
		CONTENT,
	);
	assertEquals(firstMissing(stages)!.name, "upload");
	assertEquals(stages.every((stage) => !stage.evidenced), true);
});

Deno.test("a missing row and an unanswered request are both missing", () => {
	const stages = evaluate(
		observed({ video: null }, { [urls.upload[1]]: null }),
		CONTENT,
	);
	assertEquals(stages[0].missing, [
		"https://content.example/videos/abc/original.mp3 did not answer (no response)",
	]);
	assertEquals(stages[1].missing, [
		'videoByID("abc") from https://api.example returned null',
	]);
});
