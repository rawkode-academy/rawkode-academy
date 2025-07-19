import type { APIRoute } from "astro";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

export async function getStaticPaths() {
	// Return empty array since API endpoints are development-only
	return [];
}

interface UpdateStoryRequest {
	title?: string;
	description?: string;
	personaId?: string;
	iWant?: string;
	soThat?: string;
	acceptanceCriteria?: string[];
	priority?: "must" | "should" | "could" | "wont";
	size?: "XS" | "S" | "M" | "L" | "XL";
	activityId?: string;
	featureId?: string | null;
}

async function findStoryFile(slug: string): Promise<string | null> {
	const storiesDir = join(process.cwd(), "src", "content", "stories");
	const files = await readdir(storiesDir);

	// Find file that matches the slug
	const matchingFile = files.find((file) => file.includes(slug));
	return matchingFile || null;
}

function updateFrontmatter(
	content: string,
	updates: UpdateStoryRequest,
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
				} else if (
					trimmedKey === "description" &&
					updates.description !== undefined
				) {
					return `description: ${JSON.stringify(updates.description)}`;
				} else if (
					trimmedKey === "personaId" &&
					updates.personaId !== undefined
				) {
					return `personaId: ${JSON.stringify(updates.personaId)}`;
				} else if (trimmedKey === "iWant" && updates.iWant !== undefined) {
					return `iWant: ${JSON.stringify(updates.iWant)}`;
				} else if (trimmedKey === "soThat" && updates.soThat !== undefined) {
					return `soThat: ${JSON.stringify(updates.soThat)}`;
				} else if (
					trimmedKey === "priority" &&
					updates.priority !== undefined
				) {
					return `priority: ${JSON.stringify(updates.priority)}`;
				} else if (trimmedKey === "size" && updates.size !== undefined) {
					return `size: ${JSON.stringify(updates.size)}`;
				} else if (
					trimmedKey === "activityId" &&
					updates.activityId !== undefined
				) {
					return `activityId: ${JSON.stringify(updates.activityId)}`;
				} else if (
					trimmedKey === "featureId" &&
					updates.featureId !== undefined
				) {
					return updates.featureId
						? `featureId: ${JSON.stringify(updates.featureId)}`
						: "";
				}
			}
			return line;
		})
		.filter((line) => line !== ""); // Remove empty lines

	// Handle acceptanceCriteria array separately
	if (updates.acceptanceCriteria !== undefined) {
		// Remove old acceptanceCriteria
		let inAcceptanceCriteria = false;
		const cleanedLines = [];
		for (const line of updatedLines) {
			if (line.startsWith("acceptanceCriteria:")) {
				inAcceptanceCriteria = true;
				continue;
			}
			if (inAcceptanceCriteria && line.startsWith("  -")) {
				continue;
			}
			if (inAcceptanceCriteria && !line.startsWith("  ")) {
				inAcceptanceCriteria = false;
			}
			if (!inAcceptanceCriteria) {
				cleanedLines.push(line);
			}
		}

		// Add new acceptanceCriteria
		const criteriaLines = ["acceptanceCriteria:"];
		for (const criterion of updates.acceptanceCriteria) {
			criteriaLines.push(`  - ${JSON.stringify(criterion)}`);
		}

		// Find where to insert (before priority)
		const priorityIndex = cleanedLines.findIndex((line) =>
			line.startsWith("priority:"),
		);
		if (priorityIndex > -1) {
			cleanedLines.splice(priorityIndex, 0, ...criteriaLines);
		} else {
			cleanedLines.push(...criteriaLines);
		}

		return `---\n${cleanedLines.join("\n")}\n---\n${body}`;
	}

	return `---\n${updatedLines.join("\n")}\n---\n${body}`;
}

export const PATCH: APIRoute = async ({ params, request }) => {
	try {
		const slug = params.slug;
		if (!slug) {
			return new Response(JSON.stringify({ error: "Story slug is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Find the story file
		const filename = await findStoryFile(slug);
		if (!filename) {
			return new Response(JSON.stringify({ error: "Story not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Read the current content
		const filePath = join(process.cwd(), "src", "content", "stories", filename);
		const currentContent = await readFile(filePath, "utf-8");

		// Parse request body
		const updates: UpdateStoryRequest = await request.json();

		// Update the frontmatter
		const updatedContent = updateFrontmatter(currentContent, updates);

		// Write the updated content
		await writeFile(filePath, updatedContent, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				message: "Story updated successfully",
				filename,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error updating story:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to update story",
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
			message: "Story API endpoint",
			slug,
			endpoints: {
				"PATCH /api/stories/[slug]": "Update an existing story",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
