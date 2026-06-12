import type { MarkdownHeading } from "astro";

export interface BuildHowToJsonLdInput {
	siteUrl: string;
	articleUrl: string;
	name: string;
	description: string;
	imageUrl?: string;
	publishedAt: Date;
	updatedAt?: Date;
	/** From Astro's `render(article)` return value. */
	headings: ReadonlyArray<MarkdownHeading>;
	/** Raw markdown source of the article. */
	body: string;
	/** Optional ISO 8601 duration for the whole tutorial (e.g. "PT45M"). */
	totalTime?: string;
}

/**
 * Build a schema.org HowTo JSON-LD payload for a tutorial article.
 *
 * Steps come from the article's level-2 headings; the step `text` is the
 * paragraph (or two) of body content immediately following each h2. We
 * skip emission entirely if the article doesn't have at least two h2
 * steps with non-trivial body text — HowTo specifically wants procedural
 * step-by-step content, not deep-dive explainers with section headings.
 *
 * Google's HowTo rich result lost desktop support in 2023, but mobile
 * still renders it, voice assistants consume it, and Bing / Brave /
 * DuckDuckGo / other tools use it for "how do I X" queries. The
 * structured-data emit is also valid schema.org regardless of rendering
 * support.
 *
 * Returns `undefined` when the article isn't a good HowTo candidate so
 * the caller can skip emission cleanly.
 */
export function buildHowToJsonLd(
	input: BuildHowToJsonLdInput,
): Record<string, unknown> | undefined {
	const {
		articleUrl,
		name,
		description,
		imageUrl,
		publishedAt,
		updatedAt,
		headings,
		body,
		totalTime,
	} = input;

	const h2 = headings.filter((h) => h.depth === 2);
	if (h2.length < 2) return undefined;

	// Carve the body into sections keyed by h2 slug. Each section starts at
	// its heading and ends where the next h2 starts (or EOF). We match the
	// raw heading text rather than the slug since markdown bodies don't
	// carry slug attributes.
	const sections = sliceBodyByH2(body);

	const steps = h2
		.map((heading, index) => {
			const stepText = extractStepText(sections.get(heading.text) ?? "");
			if (!stepText) return undefined;
			const step: Record<string, unknown> = {
				"@type": "HowToStep",
				position: index + 1,
				name: heading.text,
				text: stepText,
				url: `${articleUrl}#${heading.slug}`,
			};
			return step;
		})
		.filter((s): s is Record<string, unknown> => s !== undefined);

	// If fewer than half the h2s yielded usable step text, this isn't a
	// procedural HowTo — bail rather than ship a half-populated block.
	if (steps.length < 2 || steps.length < Math.ceil(h2.length / 2)) {
		return undefined;
	}

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name,
		description,
		url: articleUrl,
		datePublished: publishedAt.toISOString(),
		dateModified: (updatedAt ?? publishedAt).toISOString(),
		step: steps,
	};
	if (imageUrl) jsonLd.image = imageUrl;
	if (totalTime) jsonLd.totalTime = totalTime;

	return jsonLd;
}

/** Map of h2 heading text -> section body (everything between this h2 and the next). */
function sliceBodyByH2(body: string): Map<string, string> {
	const sections = new Map<string, string>();
	// `^## Heading text` lines, allowing trailing spaces.
	const headingRegex = /^##\s+(.+?)\s*$/gm;

	const matches: Array<{ text: string; start: number; end: number }> = [];
	let m: RegExpExecArray | null;
	while ((m = headingRegex.exec(body)) !== null) {
		matches.push({ text: m[1] ?? "", start: m.index + m[0].length, end: 0 });
	}
	for (let i = 0; i < matches.length; i++) {
		const current = matches[i];
		const next = matches[i + 1];
		if (!current) continue;
		current.end = next ? next.start - next.text.length - 3 : body.length;
		sections.set(current.text, body.slice(current.start, current.end));
	}
	return sections;
}

/**
 * Pull the first useful paragraph from a section's body, stripping
 * markdown noise. Skips empty lines, code fences, and lists — falls back
 * to the first prose paragraph it finds. Trims to a reasonable length
 * so HowToStep.text doesn't carry the entire section.
 */
function extractStepText(section: string): string | undefined {
	// Drop fenced code blocks entirely — they're not useful as step prose.
	const withoutCode = section.replace(/```[\s\S]*?```/g, "\n");
	// Split on blank lines into paragraphs.
	const paragraphs = withoutCode
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	for (const paragraph of paragraphs) {
		// Skip headings, lists, blockquotes, HTML, and import statements.
		if (/^#+\s/.test(paragraph)) continue;
		if (/^[-*]\s/.test(paragraph)) continue;
		if (/^\d+\.\s/.test(paragraph)) continue;
		if (/^>\s/.test(paragraph)) continue;
		if (/^<[A-Za-z]/.test(paragraph)) continue;
		if (/^import\s/.test(paragraph)) continue;

		const cleaned = stripMarkdownInline(paragraph).replace(/\s+/g, " ").trim();
		if (cleaned.length === 0) continue;

		// Cap at ~500 chars to keep the JSON-LD compact.
		if (cleaned.length > 500) {
			const truncated = cleaned.slice(0, 497);
			const lastBoundary = Math.max(
				truncated.lastIndexOf(". "),
				truncated.lastIndexOf("! "),
				truncated.lastIndexOf("? "),
			);
			return lastBoundary > 200
				? `${truncated.slice(0, lastBoundary + 1)}`
				: `${truncated}...`;
		}
		return cleaned;
	}

	return undefined;
}

/**
 * Strip the most common inline markdown so HowToStep.text reads as plain
 * prose: links to plain text, bold/italic markers gone, inline code
 * delimiters removed.
 */
function stripMarkdownInline(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link text](url) -> link text
		.replace(/!\[[^\]]*\]\([^)]+\)/g, "") // ![alt](image url) -> empty
		.replace(/`([^`]+)`/g, "$1") // `code` -> code
		.replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
		.replace(/__([^_]+)__/g, "$1") // __bold__ -> bold
		.replace(/(?<!\*)\*([^*\s][^*]*?)\*(?!\*)/g, "$1") // *italic* -> italic
		.replace(/(?<!_)_([^_\s][^_]*?)_(?!_)/g, "$1"); // _italic_ -> italic
}
