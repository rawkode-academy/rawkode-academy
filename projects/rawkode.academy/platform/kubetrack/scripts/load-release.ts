// Loads one Kubernetes release (cards and quiz) into platform-kubetrack from a
// release bundle: a Markdown file drafted by the kubetrack skill, never kept in
// the repo.
//
//   bun run scripts/load-release.ts <bundle.md> [--dry-run]       lint and report (default)
//   bun run scripts/load-release.ts <bundle.md> --emit-sql out.sql write the SQL
//   bun run scripts/load-release.ts <bundle.md> --apply           load into production D1
//
// The SQL upserts the release, deletes its features and questions, then inserts
// them again, so loading the same bundle twice gives the same rows.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type DocNode, toText } from "@rawkodeacademy/rich-text";
import { fromMarkdown } from "@rawkodeacademy/rich-text/markdown";
import { validateDoc } from "@rawkodeacademy/rich-text/schema";
import {
	QUESTION_KINDS,
	type QuestionKind,
	type QuizChoice,
	STAGES,
	type Stage,
	type StageCounts,
} from "../data-model/schema";

export interface ReleaseRow {
	id: string;
	major: number;
	minor: number;
	title: string;
	codename: string | null;
	summary: string;
	body: DocNode;
	releasedAt: Date;
	publishedAt: Date;
	releaseBlogUrl: string | null;
	changelogUrl: string | null;
	upstreamCounts: StageCounts | null;
}

export interface FeatureRow {
	id: string;
	releaseId: string;
	slug: string;
	kep: number;
	title: string;
	stage: Stage;
	sig: string | null;
	theme: string | null;
	featureGate: string | null;
	enabledByDefault: boolean | null;
	previousStage: Stage | null;
	previousStageVersion: string | null;
	summary: string;
	body: DocNode;
	example: DocNode | null;
	docsUrl: string | null;
	sortOrder: number;
}

export interface QuestionRow {
	id: string;
	releaseId: string;
	featureId: string | null;
	kind: QuestionKind;
	prompt: DocNode;
	choices: QuizChoice[];
	answerIds: string[];
	explanation: DocNode;
	sortOrder: number;
}

export interface Bundle {
	release: ReleaseRow;
	features: FeatureRow[];
	questions: QuestionRow[];
}

interface ParseResult {
	// Null when the bundle has errors.
	bundle: Bundle | null;
	errors: string[];
	warnings: string[];
}

const SUMMARY_MAX = 160;
const WORDS_PER_MINUTE = 230;
const CHOICE_IDS = "abcd";
const EXAMPLE_LANGUAGES = ["yaml", "yml", "shell", "sh", "bash", "console"];

interface Line {
	text: string;
	// 1-based line number in the bundle.
	no: number;
}

interface Section {
	heading: string;
	no: number;
	lines: Line[];
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// Card summaries and quiz choices are stored and shown as plain text.
const PLAIN_TEXT_MARKUP = /`|\*\*/;

// Splits lines into sections at headings of exactly `level`, ignoring
// headings inside fenced code (a shell comment such as `## build` is code).
function splitAt(
	lines: Line[],
	level: number,
): { before: Line[]; sections: Section[] } {
	const marker = new RegExp(`^#{${level}}\\s+(.*?)\\s*#*\\s*$`);
	const before: Line[] = [];
	const sections: Section[] = [];
	let fence: string | null = null;
	for (const line of lines) {
		const open = line.text.match(FENCE);
		if (open) {
			const run = open[1] as string;
			if (fence === null) fence = run;
			else if (run[0] === fence[0] && run.length >= fence.length) fence = null;
		}
		const heading = fence === null && !open ? line.text.match(marker) : null;
		if (heading) {
			sections.push({ heading: heading[1] as string, no: line.no, lines: [] });
			continue;
		}
		const current = sections.at(-1);
		if (current) current.lines.push(line);
		else before.push(line);
	}
	return { before, sections };
}

// Removes HTML comments outside fenced code (the skill marks unverified facts
// with <!-- TODO verify: ... -->, and rich text has no comments). Line numbers
// are kept; each comment is reported with the line it starts on.
function stripComments(
	lines: Line[],
	onComment: (no: number, comment: string) => void,
	onUnclosed: (no: number) => void,
): Line[] {
	let fence: string | null = null;
	let open = null as { no: number; text: string } | null;
	const stripped = lines.map((line) => {
		if (open === null) {
			const marker = line.text.match(FENCE);
			if (marker) {
				const run = marker[1] as string;
				if (fence === null) fence = run;
				else if (run[0] === fence[0] && run.length >= fence.length)
					fence = null;
				return line;
			}
			if (fence !== null) return line;
		}
		if (open === null && !line.text.includes("<!--")) return line;
		let text = line.text;
		let out = "";
		while (text !== "") {
			if (open !== null) {
				const end = text.indexOf("-->");
				if (end === -1) {
					open.text += `\n${text}`;
					text = "";
				} else {
					onComment(open.no, open.text + text.slice(0, end));
					open = null;
					text = text.slice(end + 3);
				}
			} else {
				const start = text.indexOf("<!--");
				if (start === -1) {
					out += text;
					text = "";
				} else {
					out += text.slice(0, start);
					open = { no: line.no, text: "" };
					text = text.slice(start + 4);
				}
			}
		}
		return { text: out.trimEnd(), no: line.no };
	});
	if (open !== null) onUnclosed(open.no);
	return stripped;
}

const joinLines = (lines: Line[]) =>
	lines
		.map((line) => line.text)
		.join("\n")
		.trim();

const isBlank = (doc: DocNode) => toText(doc).trim() === "";

const parts = (heading: string) =>
	heading.split("·").map((part) => part.trim());

// "-" or "" in a heading slot or meta line means "not set".
const optional = (value: string | undefined) =>
	value === undefined || value === "" || value === "-" ? null : value;

const isUrl = (value: string) => {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
};

// Abbreviations that end in a full stop without ending a sentence.
const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|cf|approx)\.(?=\s)/gi;

export function sentenceCount(text: string): number {
	const plain = text
		.replace(/`[^`]*`/g, "code")
		.replace(ABBREVIATIONS, "abbr")
		.trim();
	if (plain === "") return 0;
	// A terminator followed by more text starts another sentence.
	return plain.split(/[.!?]+["')\]]*\s+(?=\S)/).length;
}

function parseDate(value: unknown): Date | null {
	if (value instanceof Date)
		return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value !== "string") return null;
	// A time needs a zone: without one, Date reads it in the loader's local time.
	if (!/^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value))
		return null;
	// Date-only values are midnight UTC.
	const date = new Date(
		/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value,
	);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function parseBundle(
	source: string,
	options: { file?: string; now?: Date } = {},
): ParseResult {
	const file = options.file ?? "<bundle>";
	const now = options.now ?? new Date();
	const errors: string[] = [];
	const warnings: string[] = [];
	const error = (no: number | null, message: string) =>
		errors.push(
			no === null ? `${file}: ${message}` : `${file}:${no}: ${message}`,
		);
	const warn = (message: string) => warnings.push(`${file}: ${message}`);

	// Converts and validates Markdown; null (with an error) if it does not fit
	// the rich-text schema.
	const richText = (markdown: string, no: number, what: string) => {
		try {
			// No `file`: the converter's line numbers count from the snippet, and
			// the error is prefixed with the bundle line instead.
			const doc = fromMarkdown(markdown, { mdx: false });
			validateDoc(doc);
			return doc;
		} catch (cause) {
			error(no, `${what}: ${(cause as Error).message}`);
			return null;
		}
	};

	const lines = stripComments(
		source
			.replace(/\r\n?/g, "\n")
			.split("\n")
			.map((text, index) => ({ text, no: index + 1 })),
		(no, comment) => {
			if (/TODO/i.test(comment))
				warn(`line ${no}: ${comment.replace(/\s+/g, " ").trim()}`);
		},
		(no) => error(no, "unclosed <!-- comment (no matching -->)"),
	);

	// ---- frontmatter
	if (lines[0]?.text.trim() !== "---") {
		error(1, "the bundle must start with YAML frontmatter (---)");
		return { bundle: null, errors, warnings };
	}
	const close = lines.findIndex(
		(line, index) => index > 0 && line.text.trim() === "---",
	);
	if (close === -1) {
		error(1, "the frontmatter is not closed (---)");
		return { bundle: null, errors, warnings };
	}
	let meta: Record<string, unknown> = {};
	try {
		const parsed = Bun.YAML.parse(joinLines(lines.slice(1, close)));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
			meta = parsed as Record<string, unknown>;
		else error(1, "the frontmatter must be a YAML mapping");
	} catch (cause) {
		error(1, `the frontmatter is not valid YAML: ${(cause as Error).message}`);
	}

	const metaString = (key: string, required: boolean) => {
		const value = meta[key];
		if (value === undefined || value === null || value === "") {
			if (required) error(1, `frontmatter: ${key} is required`);
			return null;
		}
		if (typeof value !== "string") {
			error(1, `frontmatter: ${key} must be a string`);
			return null;
		}
		return value.trim();
	};
	const metaUrl = (key: string) => {
		const value = metaString(key, false);
		if (value !== null && !isUrl(value))
			error(1, `frontmatter: ${key} is not an http(s) URL: ${value}`);
		return value;
	};
	const metaDate = (key: string) => {
		const value = meta[key];
		const date = parseDate(value);
		if (!date)
			error(
				1,
				`frontmatter: ${key} must be a date (YYYY-MM-DD, or ISO 8601 with Z or an offset), got ${JSON.stringify(value ?? null)}`,
			);
		return date;
	};

	// An unquoted 1.30 would be read as the number 1.3, so the id must be a string.
	const releaseId = metaString("id", true);
	const version = releaseId?.match(/^(\d+)\.(\d+)$/);
	if (
		releaseId !== null &&
		(!version || releaseId !== `${Number(version[1])}.${Number(version[2])}`)
	)
		error(1, `frontmatter: id must look like "1.37", got "${releaseId}"`);
	const title = metaString("title", true);
	const codename = metaString("codename", false);
	const summary = metaString("summary", true);
	if (summary !== null && summary.length > SUMMARY_MAX)
		error(
			1,
			`frontmatter: summary is ${summary.length} characters (at most ${SUMMARY_MAX})`,
		);
	const releasedAt = metaDate("releasedAt");
	const publishedAt = metaDate("publishedAt");
	if (releasedAt && publishedAt && publishedAt < releasedAt)
		warn("publishedAt is before releasedAt");
	if (publishedAt && publishedAt <= now)
		warn(
			"publishedAt is not in the future: the release is public as soon as it loads",
		);
	const releaseBlogUrl = metaUrl("releaseBlogUrl");
	const changelogUrl = metaUrl("changelogUrl");

	let upstreamCounts: StageCounts | null = null;
	if (meta.upstreamCounts !== undefined && meta.upstreamCounts !== null) {
		const raw = meta.upstreamCounts as Record<string, unknown>;
		const counts = {} as StageCounts;
		let valid = typeof raw === "object" && !Array.isArray(raw);
		for (const stage of STAGES) {
			const value = valid ? raw[stage] : undefined;
			if (typeof value === "number" && Number.isInteger(value) && value >= 0)
				counts[stage] = value;
			else valid = false;
		}
		if (valid) upstreamCounts = counts;
		else
			error(
				1,
				`frontmatter: upstreamCounts needs whole numbers for ${STAGES.join(", ")}`,
			);
	}
	for (const key of Object.keys(meta))
		if (
			![
				"id",
				"title",
				"codename",
				"summary",
				"releasedAt",
				"publishedAt",
				"releaseBlogUrl",
				"changelogUrl",
				"upstreamCounts",
			].includes(key)
		)
			error(1, `frontmatter: unknown key ${key}`);

	// ---- body: intro, features, quiz
	const rest = lines.slice(close + 1);
	const { before, sections } = splitAt(rest, 2);
	const introLines = [...before];
	const featureSections: Section[] = [];
	let quizSection: Section | null = null;
	for (const section of sections) {
		if (/^KEP-/i.test(section.heading)) {
			if (quizSection)
				error(section.no, "feature cards must come before ## Quiz");
			featureSections.push(section);
		} else if (section.heading.toLowerCase() === "quiz") {
			if (quizSection) error(section.no, "more than one ## Quiz section");
			quizSection = section;
		} else if (featureSections.length === 0 && !quizSection) {
			// An H2 before the first card is part of the intro.
			introLines.push(
				{ text: `## ${section.heading}`, no: section.no },
				...section.lines,
			);
		} else {
			error(
				section.no,
				`unexpected heading "## ${section.heading}" (expected "## KEP-<n> · <stage> · ..." or "## Quiz")`,
			);
		}
	}

	const introMarkdown = joinLines(introLines);
	const introNo = introLines[0]?.no ?? close + 2;
	const body = richText(introMarkdown, introNo, "intro");
	if (body && isBlank(body)) error(introNo, "the release intro is empty");

	// ---- features
	const features: FeatureRow[] = [];
	const featuresByKep = new Map<number, FeatureRow>();
	for (const [index, section] of featureSections.entries()) {
		const feature = parseFeature(section, index + 1);
		if (!feature) continue;
		const existing = featuresByKep.get(feature.kep);
		if (existing)
			error(
				section.no,
				`duplicate KEP-${feature.kep} (also card ${existing.sortOrder})`,
			);
		else featuresByKep.set(feature.kep, feature);
		features.push(feature);
	}
	if (featureSections.length === 0)
		error(null, "the bundle has no feature cards");

	function parseFeature(
		section: Section,
		sortOrder: number,
	): FeatureRow | null {
		const [kepPart, stagePart, sigPart, gatePart, titlePart, ...extra] = parts(
			section.heading,
		);
		const label = kepPart ?? section.heading;
		const fail = (message: string) => error(section.no, `${label}: ${message}`);
		const kepMatch = kepPart?.match(/^KEP-(\d+)$/i);
		if (!kepMatch) {
			fail(`the heading must start with KEP-<number>`);
			return null;
		}
		const kep = Number(kepMatch[1]);
		const stage = stagePart?.toLowerCase() as Stage;
		if (!STAGES.includes(stage)) {
			fail(
				`stage must be one of ${STAGES.join(", ")}, got "${stagePart ?? ""}"`,
			);
			return null;
		}
		if (extra.length > 0) fail("too many · parts in the heading");
		const sig = optional(sigPart)?.toLowerCase().replace(/^sig-/, "") ?? null;
		const featureGate = optional(gatePart);

		const { before: head, sections: parts3 } = splitAt(section.lines, 3);

		// Meta lines ("key: value") before the first ### heading.
		const fields = new Map<string, { value: string; no: number }>();
		let freeText = false;
		for (const line of head) {
			if (line.text.trim() === "") continue;
			const field = line.text.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
			if (!field) {
				if (!freeText) {
					error(
						line.no,
						`${label}: expected "key: value" before the first ### heading`,
					);
					freeText = true;
				}
				continue;
			}
			const key = (field[1] as string).toLowerCase();
			if (fields.has(key)) error(line.no, `${label}: ${field[1]} is set twice`);
			fields.set(key, { value: (field[2] as string).trim(), no: line.no });
		}
		for (const [key, { no }] of fields)
			if (
				![
					"title",
					"what",
					"gate-default",
					"previous",
					"theme",
					"docs",
				].includes(key)
			)
				error(no, `${label}: unknown field ${key}`);

		const cardTitle =
			optional(fields.get("title")?.value) ?? optional(titlePart);
		if (!cardTitle)
			fail('a title is required ("title: ..." or a fifth heading part)');

		const what = fields.get("what")?.value ?? "";
		if (what === "") fail('"What:" is required');
		else {
			if (what.length > SUMMARY_MAX)
				fail(`What is ${what.length} characters (at most ${SUMMARY_MAX})`);
			if (sentenceCount(what) > 1) fail("What must be one sentence");
			if (PLAIN_TEXT_MARKUP.test(what))
				fail("What is plain text: drop the Markdown (` or **)");
		}

		let enabledByDefault: boolean | null = null;
		const gateDefault = fields.get("gate-default");
		if (gateDefault) {
			const value = gateDefault.value.toLowerCase();
			if (["on", "true", "yes"].includes(value)) enabledByDefault = true;
			else if (["off", "false", "no"].includes(value)) enabledByDefault = false;
			else
				error(
					gateDefault.no,
					`${label}: gate-default must be on or off, got "${gateDefault.value}"`,
				);
		}

		let previousStage: Stage | null = null;
		let previousStageVersion: string | null = null;
		const previous = fields.get("previous");
		if (previous) {
			const match = previous.value.match(/^(\w+)@v?(\d+\.\d+)$/);
			const prevStage = match?.[1]?.toLowerCase() as Stage | undefined;
			if (!match || !prevStage || !STAGES.includes(prevStage))
				error(
					previous.no,
					`${label}: previous must look like beta@1.35, got "${previous.value}"`,
				);
			else {
				previousStage = prevStage;
				previousStageVersion = match[2] as string;
			}
		}

		const docs = fields.get("docs");
		const docsUrl = optional(docs?.value);
		if (docs && docsUrl && !isUrl(docsUrl))
			error(docs.no, `${label}: docs is not an http(s) URL: ${docsUrl}`);

		// ### Why it matters, ### How to use it, then an optional ### Example.
		const expected = ["why it matters", "how to use it", "example"];
		const found = new Map<string, Section>();
		let last = -1;
		for (const part of parts3) {
			const key = part.heading.toLowerCase();
			const position = expected.indexOf(key);
			if (position === -1) {
				error(
					part.no,
					`${label}: unexpected section "### ${part.heading}" (cards have Why it matters, How to use it and Example)`,
				);
				continue;
			}
			if (found.has(key))
				error(part.no, `${label}: "### ${part.heading}" appears twice`);
			else if (position < last)
				error(part.no, `${label}: "### ${part.heading}" is out of order`);
			found.set(key, part);
			last = Math.max(last, position);
		}
		const why = found.get("why it matters");
		const how = found.get("how to use it");
		if (!why) fail('the "### Why it matters" section is missing');
		else if (joinLines(why.lines) === "")
			error(why.no, `${label}: "Why it matters" is empty`);
		if (!how) fail('the "### How to use it" section is missing');
		else if (joinLines(how.lines) === "")
			error(how.no, `${label}: "How to use it" is empty`);

		const bodyMarkdown = [why, how]
			.filter((part): part is Section => part !== undefined)
			.map((part) => `### ${part.heading}\n\n${joinLines(part.lines)}`)
			.join("\n\n");
		const featureBody = bodyMarkdown
			? richText(bodyMarkdown, (why ?? how)?.no ?? section.no, `${label} body`)
			: null;

		let example: DocNode | null = null;
		const examplePart = found.get("example");
		if (examplePart) {
			example = richText(
				joinLines(examplePart.lines),
				examplePart.no,
				`${label} example`,
			);
			const nodes = example?.content ?? [];
			const code = nodes[0];
			if (example && (nodes.length !== 1 || code?.type !== "codeBlock")) {
				error(
					examplePart.no,
					`${label}: Example must be a single code block and nothing else`,
				);
				example = null;
			} else if (code?.type === "codeBlock") {
				const language = code.attrs.language?.toLowerCase() ?? null;
				const text = code.content?.[0]?.text ?? "";
				if (language === null || !EXAMPLE_LANGUAGES.includes(language))
					warn(
						`${label}: Example language is ${language ?? "not set"} (expected yaml or shell)`,
					);
				if (language === "yaml" || language === "yml") {
					try {
						Bun.YAML.parse(text);
					} catch (cause) {
						error(
							examplePart.no,
							`${label}: Example YAML does not parse: ${(cause as Error).message}`,
						);
					}
				}
			}
		}

		if (!cardTitle || what === "" || !featureBody || !releaseId) return null;
		const slug = `kep-${kep}`;
		return {
			id: `${releaseId}/${slug}`,
			releaseId,
			slug,
			kep,
			title: cardTitle,
			stage,
			sig,
			theme: optional(fields.get("theme")?.value),
			featureGate,
			enabledByDefault,
			previousStage,
			previousStageVersion,
			summary: what,
			body: featureBody,
			example,
			docsUrl,
			sortOrder,
		};
	}

	// ---- quiz
	const questions: QuestionRow[] = [];
	if (!quizSection) error(null, "the bundle has no ## Quiz section");
	else {
		const { before: quizIntro, sections: questionSections } = splitAt(
			quizSection.lines,
			3,
		);
		const stray = quizIntro.find((line) => line.text.trim() !== "");
		if (stray)
			error(stray.no, "text under ## Quiz must belong to a ### question");
		const seen = new Set<string>();
		for (const [index, section] of questionSections.entries()) {
			const question = parseQuestion(section, index + 1);
			if (!question) continue;
			if (seen.has(question.id))
				error(section.no, `duplicate question ${question.id}`);
			seen.add(question.id);
			questions.push(question);
		}
		if (questionSections.length === 0)
			error(quizSection.no, "the quiz has no questions");
	}

	function parseQuestion(
		section: Section,
		sortOrder: number,
	): QuestionRow | null {
		const [idPart, kepPart, kindPart, ...extra] = parts(section.heading);
		const label = idPart || section.heading;
		const fail = (message: string) => error(section.no, `${label}: ${message}`);
		if (!idPart || !/^q\d+$/i.test(idPart)) {
			fail('the heading must look like "q01 · kep-1710 · single"');
			return null;
		}
		if (extra.length > 0) fail("too many · parts in the heading");
		const kind = kindPart?.toLowerCase() as QuestionKind;
		if (!QUESTION_KINDS.includes(kind)) {
			fail(
				`kind must be one of ${QUESTION_KINDS.join(", ")}, got "${kindPart ?? ""}"`,
			);
			return null;
		}
		let featureId: string | null = null;
		const kepRef = optional(kepPart);
		if (kepRef !== null) {
			const match = kepRef.match(/^(?:kep-)?(\d+)$/i);
			const feature = match ? featuresByKep.get(Number(match[1])) : undefined;
			if (!feature) fail(`${kepRef} is not a card in this bundle`);
			else featureId = feature.id;
		}

		// Prompt, then the "- [ ]"/"- [x]" choices, then a "> " explanation.
		const prompt: Line[] = [];
		const explanation: Line[] = [];
		const choices: QuizChoice[] = [];
		const answerIds: string[] = [];
		let phase: "prompt" | "choices" | "explanation" = "prompt";
		let fence: string | null = null;
		for (const line of section.lines) {
			const marker = line.text.match(FENCE);
			const run = marker?.[1];
			if (run && fence === null) fence = run;
			else if (
				run &&
				fence &&
				run[0] === fence[0] &&
				run.length >= fence.length
			)
				fence = null;
			const inFence = fence !== null || marker !== null;
			const choice =
				!inFence && line.text.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
			const quote = !inFence && line.text.match(/^\s*>\s?(.*)$/);
			if (choice) {
				if (phase === "explanation") {
					error(line.no, `${label}: choices must come before the explanation`);
					continue;
				}
				phase = "choices";
				// "- [x] b It mounts the volume": the letter after the box is the id.
				const id = CHOICE_IDS[choices.length] as string;
				if (choices.length === CHOICE_IDS.length) {
					error(line.no, `${label}: at most ${CHOICE_IDS.length} choices`);
					continue;
				}
				const labelled = (choice[2] as string).match(/^([a-z])(?:\s+(.*))?$/);
				if (labelled?.[1] !== id) {
					error(
						line.no,
						`${label}: choice ${choices.length + 1} must start with its letter "${id}"`,
					);
					continue;
				}
				const text = (labelled[2] ?? "").trim();
				if (text === "") error(line.no, `${label}: choice ${id} is empty`);
				if (PLAIN_TEXT_MARKUP.test(text))
					error(
						line.no,
						`${label}: choice ${id} is plain text: drop the Markdown (\` or **)`,
					);
				choices.push({ id, text });
				if ((choice[1] as string).toLowerCase() === "x") answerIds.push(id);
			} else if (quote) {
				phase = "explanation";
				explanation.push({ text: quote[1] as string, no: line.no });
			} else if (phase === "prompt") {
				prompt.push(line);
			} else if (line.text.trim() !== "") {
				error(
					line.no,
					`${label}: unexpected text after the ${phase === "choices" ? "choices" : "explanation"}`,
				);
			}
		}

		const promptDoc = richText(
			joinLines(prompt),
			section.no,
			`${label} prompt`,
		);
		if (promptDoc && isBlank(promptDoc)) fail("the prompt is empty");
		const explanationDoc = richText(
			joinLines(explanation),
			explanation[0]?.no ?? section.no,
			`${label} explanation`,
		);
		if (explanationDoc && isBlank(explanationDoc))
			fail('the explanation is empty (add a "> " paragraph after the choices)');

		if (choices.length < 2)
			fail(`needs at least two choices, has ${choices.length}`);
		if (
			kind === "true_false" &&
			(choices.length !== 2 ||
				choices[0]?.text !== "True" ||
				choices[1]?.text !== "False")
		)
			fail(
				'a true_false question has exactly the choices "a True" and "b False"',
			);
		if ((kind === "single" || kind === "true_false") && answerIds.length !== 1)
			fail(
				`a ${kind} question needs exactly one correct choice, has ${answerIds.length}`,
			);
		if (kind === "multiple" && answerIds.length < 2)
			fail(
				`a multiple question needs at least two correct choices, has ${answerIds.length}`,
			);

		if (!promptDoc || !explanationDoc || !releaseId) return null;
		return {
			id: `${releaseId}/${idPart.toLowerCase()}`,
			releaseId,
			featureId,
			kind,
			prompt: promptDoc,
			choices,
			answerIds,
			explanation: explanationDoc,
			sortOrder,
		};
	}

	// Every stage that has cards is tested at least once.
	const stageOf = new Map(
		features.map((feature) => [feature.id, feature.stage]),
	);
	const tested = new Set(
		questions.flatMap((question) =>
			question.featureId ? [stageOf.get(question.featureId)] : [],
		),
	);
	for (const stage of STAGES)
		if (
			features.some((feature) => feature.stage === stage) &&
			!tested.has(stage)
		)
			error(null, `no quiz question covers a ${stage} card`);

	if (upstreamCounts) {
		const derived = stageCounts(features);
		for (const stage of STAGES)
			if (derived[stage] !== upstreamCounts[stage])
				warn(
					`${stage}: ${derived[stage]} cards, but upstreamCounts says ${upstreamCounts[stage]}`,
				);
	}

	if (
		errors.length > 0 ||
		!releaseId ||
		!version ||
		!title ||
		!summary ||
		!body ||
		!releasedAt ||
		!publishedAt
	)
		return { bundle: null, errors, warnings };

	return {
		bundle: {
			release: {
				id: releaseId,
				major: Number(version[1]),
				minor: Number(version[2]),
				title,
				codename,
				summary,
				body,
				releasedAt,
				publishedAt,
				releaseBlogUrl,
				changelogUrl,
				upstreamCounts,
			},
			features,
			questions,
		},
		errors,
		warnings,
	};
}

function stageCounts(features: { stage: Stage }[]): StageCounts {
	const counts: StageCounts = { stable: 0, beta: 0, alpha: 0, deprecated: 0 };
	for (const feature of features) counts[feature.stage]++;
	return counts;
}

// Minutes to read the intro and every card (code excluded).
export function readingMinutes(bundle: Bundle): number {
	const text = [
		toText(bundle.release.body, { code: false }),
		...bundle.features.flatMap((feature) => [
			feature.title,
			feature.summary,
			toText(feature.body, { code: false }),
		]),
	].join(" ");
	const words = text.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const DISPLAY_ORDER: Stage[] = ["stable", "beta", "alpha", "deprecated"];

export function report(bundle: Bundle): string {
	const derived = stageCounts(bundle.features);
	const upstream = bundle.release.upstreamCounts;
	const rows = DISPLAY_ORDER.map(
		(stage) =>
			`  ${stage.padEnd(11)}${String(derived[stage]).padStart(5)}${
				upstream ? String(upstream[stage]).padStart(10) : ""
			}`,
	);
	const header = `  ${"stage".padEnd(11)}${"cards".padStart(5)}${upstream ? "upstream".padStart(10) : ""}`;
	const total = `  ${"total".padEnd(11)}${String(bundle.features.length).padStart(5)}${
		upstream
			? String(
					STAGES.reduce((sum, stage) => sum + upstream[stage], 0),
				).padStart(10)
			: ""
	}`;
	return [
		`${bundle.release.title}${bundle.release.codename ? ` "${bundle.release.codename}"` : ""} (${bundle.release.id})`,
		header,
		...rows,
		total,
		`  quiz questions: ${bundle.questions.length}`,
		`  estimated reading time: ${readingMinutes(bundle)} min`,
		`  publishedAt: ${bundle.release.publishedAt.toISOString()}`,
	].join("\n");
}

// ---- SQL

type SqlValue = string | number | boolean | null | Date | object;

function literal(value: SqlValue): string {
	if (value === null) return "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	if (typeof value === "number") {
		if (!Number.isFinite(value))
			throw new Error(`not a finite number: ${value}`);
		return String(value);
	}
	if (value instanceof Date) return String(Math.floor(value.getTime() / 1000));
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return `'${text.replaceAll("'", "''")}'`;
}

function insert(table: string, row: Record<string, SqlValue>): string {
	const columns = Object.keys(row).map((column) => `\`${column}\``);
	const values = Object.values(row).map(literal);
	return `INSERT INTO \`${table}\` (${columns.join(", ")}) VALUES (${values.join(", ")})`;
}

// Timestamps are seconds, except updated_at, which is milliseconds.
export function toSql(bundle: Bundle, options: { now?: Date } = {}): string {
	const now = options.now ?? new Date();
	const { release } = bundle;
	const releaseRow: Record<string, SqlValue> = {
		id: release.id,
		major: release.major,
		minor: release.minor,
		title: release.title,
		codename: release.codename,
		summary: release.summary,
		body: release.body,
		released_at: release.releasedAt,
		published_at: release.publishedAt,
		release_blog_url: release.releaseBlogUrl,
		changelog_url: release.changelogUrl,
		upstream_counts: release.upstreamCounts,
		updated_at: now.getTime(),
	};
	const updates = Object.keys(releaseRow)
		.filter((column) => column !== "id")
		.map((column) => `\`${column}\` = excluded.\`${column}\``)
		.join(", ");
	const statements = [
		`${insert("releases", releaseRow)} ON CONFLICT(\`id\`) DO UPDATE SET ${updates};`,
		`DELETE FROM \`quiz_questions\` WHERE \`release_id\` = ${literal(release.id)};`,
		`DELETE FROM \`release_features\` WHERE \`release_id\` = ${literal(release.id)};`,
		...bundle.features.map(
			(feature) =>
				`${insert("release_features", {
					id: feature.id,
					release_id: feature.releaseId,
					slug: feature.slug,
					kep: feature.kep,
					title: feature.title,
					stage: feature.stage,
					sig: feature.sig,
					theme: feature.theme,
					feature_gate: feature.featureGate,
					enabled_by_default: feature.enabledByDefault,
					previous_stage: feature.previousStage,
					previous_stage_version: feature.previousStageVersion,
					summary: feature.summary,
					body: feature.body,
					example: feature.example,
					docs_url: feature.docsUrl,
					sort_order: feature.sortOrder,
				})};`,
		),
		...bundle.questions.map(
			(question) =>
				`${insert("quiz_questions", {
					id: question.id,
					release_id: question.releaseId,
					feature_id: question.featureId,
					kind: question.kind,
					prompt: question.prompt,
					choices: question.choices,
					answer_ids: question.answerIds,
					explanation: question.explanation,
					sort_order: question.sortOrder,
				})};`,
		),
	];
	return `${statements.join("\n--> statement-breakpoint\n")}\n`;
}

// ---- CLI

const USAGE =
	"usage: bun run scripts/load-release.ts <bundle.md> [--dry-run | --emit-sql <out.sql> | --apply]";

const SERVICE_DIR = resolve(import.meta.dir, "..");
const WEBSITE_DIR = resolve(SERVICE_DIR, "../../website");

function run(command: string[], cwd: string) {
	console.error(`$ ${command.join(" ")}`);
	const result = Bun.spawnSync(command, {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	});
	if (result.exitCode !== 0)
		throw new Error(`${command[0]} exited with ${result.exitCode}`);
}

async function main(argv: string[]): Promise<number> {
	let path: string | undefined;
	let mode: "dry-run" | "emit-sql" | "apply" = "dry-run";
	let out: string | undefined;
	let modes = 0;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index] as string;
		if (arg === "--dry-run") {
			mode = "dry-run";
			modes++;
		} else if (arg === "--apply") {
			mode = "apply";
			modes++;
		} else if (arg === "--emit-sql") {
			mode = "emit-sql";
			modes++;
			out = argv[++index];
			if (!out) {
				console.error(USAGE);
				return 2;
			}
		} else if (arg.startsWith("--") || path !== undefined) {
			console.error(USAGE);
			return 2;
		} else path = arg;
	}
	if (!path || modes > 1) {
		console.error(USAGE);
		return 2;
	}

	const source = await Bun.file(path).text();
	const now = new Date();
	const { bundle, errors, warnings } = parseBundle(source, { file: path, now });
	for (const warning of warnings) console.error(`warning: ${warning}`);
	for (const message of errors) console.error(`error: ${message}`);
	if (!bundle) {
		console.error(`${errors.length} error(s); nothing written.`);
		return 1;
	}
	console.log(report(bundle));

	const sql = toSql(bundle, { now });
	if (mode === "dry-run") {
		console.log("dry run: nothing written.");
		return 0;
	}
	if (mode === "emit-sql") {
		writeFileSync(out as string, sql);
		console.log(`wrote ${out}`);
		return 0;
	}

	// --apply: production D1, then purge the website's cached pages.
	const file = join(
		mkdtempSync(join(tmpdir(), "kubetrack-")),
		`${bundle.release.id}.sql`,
	);
	writeFileSync(file, sql);
	run(
		[
			"cuenv",
			"-e",
			"production",
			"exec",
			"--",
			"bunx",
			"wrangler",
			"d1",
			"execute",
			"platform-kubetrack",
			"--remote",
			"--file",
			file,
		],
		SERVICE_DIR,
	);
	console.log(`loaded ${bundle.release.id} into production D1`);
	// The rows are in; a failed purge only delays the pages until the website's
	// hourly change detection notices the change.
	try {
		run(
			[
				"cuenv",
				"-e",
				"production",
				"exec",
				"--",
				"just",
				"invalidate-content",
				JSON.stringify({
					tags: [`kubetrackReleases:${bundle.release.id}`, "kubetrackReleases"],
				}),
			],
			WEBSITE_DIR,
		);
	} catch (cause) {
		console.error(
			`warning: cache invalidation failed (${(cause as Error).message}); the website picks the change up through its hourly change detection`,
		);
	}
	return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
