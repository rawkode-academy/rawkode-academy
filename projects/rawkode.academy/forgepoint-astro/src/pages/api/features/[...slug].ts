import type { APIRoute } from "astro";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

export async function getStaticPaths() {
	// Return empty array since API endpoints are development-only
	return [];
}

interface UpdateFeatureRequest {
	title?: string;
	description?: string;
	enhancement?: string;
	priority?: "must" | "should" | "could" | "wont";
	size?: "XS" | "S" | "M" | "L" | "XL" | null;
	dependencies?: Array<{
		id: string;
		type: "blocks" | "requires" | "relates-to";
		duration?: string;
	}>;
}

async function findFeatureFile(slug: string): Promise<string | null> {
	const featuresDir = join(process.cwd(), "src", "content", "features");
	const files = await readdir(featuresDir);

	// Find file that matches the slug
	const matchingFile = files.find((file) => file.includes(slug));
	return matchingFile || null;
}

function updateFrontmatter(
	content: string,
	updates: UpdateFeatureRequest,
): string {
	// Extract frontmatter and body
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!frontmatterMatch) {
		throw new Error("Invalid MDX file format");
	}

	const [, frontmatterContent, body] = frontmatterMatch;
	const lines = frontmatterContent.split("\n");

	// Parse and update frontmatter
	const updatedLines = lines
		.map((line) => {
			// Handle simple key-value pairs
			if (line.includes(":") && !line.startsWith("  ")) {
				const [key] = line.split(":");
				const trimmedKey = key.trim();

				if (trimmedKey === "title" && updates.title !== undefined) {
					return `title: ${JSON.stringify(updates.title)}`;
				}
				if (trimmedKey === "description" && updates.description !== undefined) {
					return `description: ${JSON.stringify(updates.description)}`;
				}
				if (trimmedKey === "enhancement" && updates.enhancement !== undefined) {
					return `enhancement: ${JSON.stringify(updates.enhancement)}`;
				}
				if (trimmedKey === "priority" && updates.priority !== undefined) {
					return `priority: ${JSON.stringify(updates.priority)}`;
				}
				if (trimmedKey === "size" && updates.size !== undefined) {
					return updates.size ? `size: ${JSON.stringify(updates.size)}` : "";
				}
			}
			return line;
		})
		.filter((line) => line !== ""); // Remove empty lines

	return `---\n${updatedLines.join("\n")}\n---\n${body}`;
}

export const PATCH: APIRoute = async ({ params, request }) => {
	try {
		const slug = params.slug;
		if (!slug) {
			return new Response(
				JSON.stringify({ error: "Feature slug is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Find the feature file
		const filename = await findFeatureFile(slug);
		if (!filename) {
			return new Response(JSON.stringify({ error: "Feature not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Read the current content
		const filePath = join(
			process.cwd(),
			"src",
			"content",
			"features",
			filename,
		);
		const currentContent = await readFile(filePath, "utf-8");

		// Parse request body
		const updates: UpdateFeatureRequest = await request.json();

		// Update the frontmatter
		const updatedContent = updateFrontmatter(currentContent, updates);

		// Write the updated content
		await writeFile(filePath, updatedContent, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				message: "Feature updated successfully",
				filename,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error updating feature:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to update feature",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug;
	return new Response(
		JSON.stringify({
			message: "Feature API endpoint",
			slug,
			endpoints: {
				"PATCH /api/features/[slug]": "Update an existing feature",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
