/**
 * Renders the content link audit as Markdown grouped by the content item
 * that needs fixing, from the summary and findings the audit just wrote.
 *
 * @module
 */
import {
	type LinkFinding,
	renderReport,
	type Summary,
} from "../behaviors/_lib/content_links.ts";

interface Handle {
	name: string;
	version?: number;
}

interface Context {
	modelType: unknown;
	modelId: string;
	executionStatus: "succeeded" | "failed";
	errorMessage?: string;
	dataHandles: Handle[];
	dataRepository: {
		getContent: (
			type: unknown,
			modelId: string,
			dataName: string,
			version?: number,
		) => Promise<Uint8Array | null>;
	};
}

async function read<T>(context: Context, name: string): Promise<T | null> {
	const handle = context.dataHandles.find((entry) => entry.name === name);
	if (!handle) return null;
	const content = await context.dataRepository.getContent(
		context.modelType,
		context.modelId,
		handle.name,
		handle.version,
	);
	return content ? JSON.parse(new TextDecoder().decode(content)) as T : null;
}

/** Report definition for the content link audit. */
export const report = {
	name: "@rawkode/academy/content-links",
	description:
		"Broken and redirected links in published content, grouped by content item",
	scope: "method" as const,
	labels: ["content", "links"],
	execute: async (
		context: Context,
	): Promise<{ markdown: string; json: Record<string, unknown> }> => {
		const summary = await read<Summary>(context, "summary");
		const findings = await read<{ links: LinkFinding[] }>(context, "findings");
		if (!summary || !findings) {
			const reason = context.errorMessage ?? "the audit wrote no findings";
			return {
				markdown: `# Content link audit\n\nNothing to report: ${reason}.\n`,
				json: { status: context.executionStatus, reason },
			};
		}
		return {
			markdown: renderReport(summary, findings.links),
			json: { summary, links: findings.links },
		};
	},
};
