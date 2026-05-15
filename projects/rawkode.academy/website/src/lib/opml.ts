export interface OpmlFeed {
	text: string;
	xmlUrl: string;
	htmlUrl?: string;
	description?: string;
}

export interface OpmlOutline {
	text: string;
	children: ReadonlyArray<OpmlFeed>;
}

export interface BuildOpmlDocumentInput {
	title: string;
	ownerName?: string;
	ownerEmail?: string;
	dateCreated?: Date;
	topLevelFeeds: ReadonlyArray<OpmlFeed>;
	groups: ReadonlyArray<OpmlOutline>;
}

function escapeXmlAttribute(value: string): string {
	return value.replace(/[<>&'"]/g, (char) => {
		switch (char) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return char;
		}
	});
}

function escapeXmlText(value: string): string {
	return value.replace(/[<>&]/g, (char) => {
		switch (char) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			default:
				return char;
		}
	});
}

function renderFeed(feed: OpmlFeed, indent: string): string {
	const attrs = [
		`text="${escapeXmlAttribute(feed.text)}"`,
		`title="${escapeXmlAttribute(feed.text)}"`,
		'type="rss"',
		`xmlUrl="${escapeXmlAttribute(feed.xmlUrl)}"`,
	];
	if (feed.htmlUrl) {
		attrs.push(`htmlUrl="${escapeXmlAttribute(feed.htmlUrl)}"`);
	}
	if (feed.description) {
		attrs.push(`description="${escapeXmlAttribute(feed.description)}"`);
	}
	return `${indent}<outline ${attrs.join(" ")}/>`;
}

/**
 * Build an OPML 2.0 document listing the feeds a reader can import in bulk.
 * Nested `<outline>` groups become folders in feed-reader UIs.
 */
export function buildOpmlDocument(input: BuildOpmlDocumentInput): string {
	const {
		title,
		ownerName,
		ownerEmail,
		dateCreated = new Date(),
		topLevelFeeds,
		groups,
	} = input;

	const headParts = [`    <title>${escapeXmlText(title)}</title>`];
	headParts.push(`    <dateCreated>${dateCreated.toUTCString()}</dateCreated>`);
	if (ownerName) {
		headParts.push(`    <ownerName>${escapeXmlText(ownerName)}</ownerName>`);
	}
	if (ownerEmail) {
		headParts.push(`    <ownerEmail>${escapeXmlText(ownerEmail)}</ownerEmail>`);
	}

	const bodyLines: string[] = [];
	for (const feed of topLevelFeeds) {
		bodyLines.push(renderFeed(feed, "    "));
	}
	for (const group of groups) {
		if (group.children.length === 0) continue;
		bodyLines.push(
			`    <outline text="${escapeXmlAttribute(group.text)}" title="${escapeXmlAttribute(group.text)}">`,
		);
		for (const feed of group.children) {
			bodyLines.push(renderFeed(feed, "      "));
		}
		bodyLines.push("    </outline>");
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
${headParts.join("\n")}
  </head>
  <body>
${bodyLines.join("\n")}
  </body>
</opml>`;
}
