type Nova3InputWithRepeatedParams = Omit<
	Ai_Cf_Deepgram_Nova_3_Input,
	"keyterm" | "replace"
> & {
	keyterm?: string | string[];
	replace?: string | string[];
};

const DEFAULT_REPLACEMENTS = [
	"rawcode:Rawkode",
	"raw code:Rawkode",
	"rockwood academy:Rawkode Academy",
	"rockwood live:Rawkode Live",
];

const TRANSCRIPT_CORRECTIONS: Array<[RegExp, string]> = [
	[/\braw code academy\b/gi, "Rawkode Academy"],
	[/\brockwood academy\b/gi, "Rawkode Academy"],
	[/\braw code lives\b/gi, "Rawkode Live"],
	[/\braw code live\b/gi, "Rawkode Live"],
	[/\brockwood live\b/gi, "Rawkode Live"],
	[/\braw code\b/gi, "Rawkode"],
	[/\brawcode\b/gi, "Rawkode"],
	[/\brockwood\b/gi, "Rawkode"],
	[/\bkupanitas\b/gi, "Kubernetes"],
	[/\bkubernetes\b/gi, "Kubernetes"],
	[/\bwassom\b/gi, "Wasm"],
	[/\bwas i'm\b/gi, "Wasm"],
	[/\bwebassembly\b/gi, "WebAssembly"],
	[/\bcompilot\b/gi, "Copilot"],
	[/\bhelm teller\b/gi, "Helm Tiller"],
	[/\bqueue based package manager\b/gi, "CUE-based package manager"],
	[/\btimoni\b/gi, "Timoni"],
	[/\bargo cd\b/gi, "ArgoCD"],
	[/\byokeflight\b/gi, "Yoke flight"],
	[/\byokeflights\b/gi, "Yoke flights"],
	[/\byoke\b/gi, "Yoke"],
];

export function buildNova3Input({
	audioBody,
	contentType,
	language,
	keyterms,
}: {
	audioBody: object;
	contentType?: string | null;
	language: string;
	keyterms: string[];
}): Nova3InputWithRepeatedParams {
	const input: Nova3InputWithRepeatedParams = {
		audio: {
			body: audioBody,
			contentType: contentType ?? "audio/mpeg",
		},
		language,
		smart_format: true,
		detect_entities: true,
		diarize: true,
		paragraphs: true,
		profanity_filter: false,
		punctuate: true,
		utterances: true,
		replace: DEFAULT_REPLACEMENTS,
	};

	if (keyterms.length > 0) {
		input.keyterm = keyterms;
	}

	return input;
}

export function asCloudflareNova3Input(
	input: Nova3InputWithRepeatedParams,
): Ai_Cf_Deepgram_Nova_3_Input {
	return input as unknown as Ai_Cf_Deepgram_Nova_3_Input;
}

export function correctTranscriptText(text: string): string {
	return TRANSCRIPT_CORRECTIONS.reduce(
		(corrected, [pattern, replacement]) =>
			corrected.replace(pattern, replacement),
		text,
	);
}
