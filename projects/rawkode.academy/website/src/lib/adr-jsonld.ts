export interface AdrAuthor {
	id: string;
	name: string;
}

export interface AdrSource {
	id: string;
	title: string;
	adoptedAt: Date;
}

export interface BuildAdrJsonLdInput {
	siteUrl: string;
	adrUrl: string;
	source: AdrSource;
	authors: ReadonlyArray<AdrAuthor>;
}

const PUBLISHER_NAME = "Rawkode Academy";
const PUBLISHER_LOGO_PATH = "/android-chrome-512x512.png";
const ARTICLE_SECTION = "Architecture Decision Records";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

export function extractAdrNumber(adrId: string): string | undefined {
	const match = adrId.match(/^(\d{4})-/);
	return match?.[1];
}

/**
 * Build a schema.org TechArticle JSON-LD payload for an Architecture Decision
 * Record. ADRs are technical documents with a fixed structure (context,
 * decision, consequences); TechArticle is the closest standard mapping that
 * Google's Article rich result pipeline already understands.
 */
export function buildAdrJsonLd(
	input: BuildAdrJsonLdInput,
): Record<string, unknown> {
	const { siteUrl, adrUrl, source, authors } = input;
	const adoptedAtIso = new Date(source.adoptedAt).toISOString();
	const adrNumber = extractAdrNumber(source.id);
	const headline = adrNumber
		? `ADR-${adrNumber}: ${source.title}`
		: source.title;

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline,
		description: `Architecture Decision Record: ${source.title}. Context, decision, and consequences from Rawkode Academy's engineering team.`,
		image: joinUrl(siteUrl, PUBLISHER_LOGO_PATH),
		url: adrUrl,
		datePublished: adoptedAtIso,
		dateModified: adoptedAtIso,
		inLanguage: "en",
		articleSection: ARTICLE_SECTION,
		mainEntityOfPage: { "@type": "WebPage", "@id": adrUrl },
		publisher: {
			"@type": "Organization",
			name: PUBLISHER_NAME,
			url: siteUrl,
			logo: {
				"@type": "ImageObject",
				url: joinUrl(siteUrl, PUBLISHER_LOGO_PATH),
			},
		},
		keywords:
			"Architecture Decision Record, ADR, cloud native, software architecture",
	};

	if (adrNumber) {
		jsonLd.identifier = `ADR-${adrNumber}`;
	}

	if (authors.length > 0) {
		jsonLd.author = authors.map((author) => ({
			"@type": "Person",
			name: author.name,
			url: joinUrl(siteUrl, `/people/${author.id}`),
		}));
	}

	return jsonLd;
}
