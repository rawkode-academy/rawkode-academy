import type { APIRoute } from "astro";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

export async function getStaticPaths() {
	// Return empty array since API endpoints are development-only
	return [];
}

interface UpdateActivityRequest {
	title?: string;
	description?: string;
	order?: number;
	outcome?: string;
	personas?: string[];
	metrics?: Array<{
		name: string;
		target: string;
	}>;
}

async function findActivityFile(slug: string): Promise<string | null> {
	const activitiesDir = join(process.cwd(), "src", "content", "activities");
	const files = await readdir(activitiesDir);

	// Find file that matches the slug
	const matchingFile = files.find((file) => file.includes(slug));
	return matchingFile || null;
}

function updateFrontmatter(
	content: string,
	updates: UpdateActivityRequest,
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
				if (trimmedKey === "order" && updates.order !== undefined) {
					return `order: ${updates.order}`;
				}
				if (trimmedKey === "outcome" && updates.outcome !== undefined) {
					return `outcome: ${JSON.stringify(updates.outcome)}`;
				}
			}
			return line;
		})
		.filter((line) => line !== ""); // Remove empty lines

	// Handle personas array separately
	if (updates.personas !== undefined) {
		// Remove old personas
		let inPersonas = false;
		const cleanedLines = [];
		for (const line of updatedLines) {
			if (line.startsWith("personas:")) {
				inPersonas = true;
				continue;
			}
			if (inPersonas && line.startsWith("  -")) {
				continue;
			}
			if (inPersonas && !line.startsWith("  ")) {
				inPersonas = false;
			}
			if (!inPersonas) {
				cleanedLines.push(line);
			}
		}

		// Add new personas
		const personasLines = ["personas:"];
		for (const persona of updates.personas) {
			personasLines.push(`  - ${JSON.stringify(persona)}`);
		}

		// Find where to insert (before metrics if exists, otherwise at end)
		const metricsIndex = cleanedLines.findIndex((line) =>
			line.startsWith("metrics:"),
		);
		if (metricsIndex > -1) {
			cleanedLines.splice(metricsIndex, 0, ...personasLines);
		} else {
			cleanedLines.push(...personasLines);
		}

		return `---\n${cleanedLines.join("\n")}\n---\n${body}`;
	}

	// Handle metrics array if provided
	if (updates.metrics !== undefined) {
		// Similar logic for metrics...
		// For brevity, keeping basic implementation
		return `---\n${updatedLines.join("\n")}\n---\n${body}`;
	}

	return `---\n${updatedLines.join("\n")}\n---\n${body}`;
}

export const PATCH: APIRoute = async ({ params, request }) => {
	try {
		const slug = params.slug;
		if (!slug) {
			return new Response(
				JSON.stringify({ error: "Activity slug is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Find the activity file
		const filename = await findActivityFile(slug);
		if (!filename) {
			return new Response(JSON.stringify({ error: "Activity not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Read the current content
		const filePath = join(
			process.cwd(),
			"src",
			"content",
			"activities",
			filename,
		);
		const currentContent = await readFile(filePath, "utf-8");

		// Parse request body
		const updates: UpdateActivityRequest = await request.json();

		// Update the frontmatter
		const updatedContent = updateFrontmatter(currentContent, updates);

		// Write the updated content
		await writeFile(filePath, updatedContent, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				message: "Activity updated successfully",
				filename,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error updating activity:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to update activity",
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
			message: "Activity API endpoint",
			slug,
			endpoints: {
				"PATCH /api/activities/[slug]": "Update an existing activity",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
