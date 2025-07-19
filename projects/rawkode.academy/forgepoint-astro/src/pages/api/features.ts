import type { APIRoute } from "astro";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

interface CreateFeatureRequest {
	title: string;
	description: string;
	enhancement: string;
	priority: "must" | "should" | "could" | "wont";
	size?: "XS" | "S" | "M" | "L" | "XL";
	dependencies?: Array<{
		id: string;
		type: "blocks" | "requires" | "relates-to";
		duration?: string;
	}>;
}

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
}

function generateMarkdownContent(data: CreateFeatureRequest): string {
	const frontmatter: Record<string, unknown> = {
		title: data.title,
		description: data.description,
		enhancement: data.enhancement,
		priority: data.priority,
	};

	if (data.size) {
		frontmatter.size = data.size;
	}

	if (data.dependencies && data.dependencies.length > 0) {
		frontmatter.dependencies = data.dependencies;
	}

	const yaml = Object.entries(frontmatter)
		.map(([key, value]) => {
			if (key === "dependencies" && Array.isArray(value)) {
				return `${key}:\n${value
					.map((dep) => {
						let depYaml = `  - id: ${JSON.stringify(dep.id)}\n    type: ${JSON.stringify(dep.type)}`;
						if (dep.duration) {
							depYaml += `\n    duration: ${JSON.stringify(dep.duration)}`;
						}
						return depYaml;
					})
					.join("\n")}`;
			}
			return `${key}: ${JSON.stringify(value)}`;
		})
		.join("\n");

	return `---
${yaml}
---

## Feature Overview

${data.description}

### Enhancement Details

${data.enhancement}

### Priority: ${data.priority.toUpperCase()}

${data.size ? `### Estimated Size: ${data.size}` : ""}

${
	data.dependencies && data.dependencies.length > 0
		? `### Dependencies

${data.dependencies
	.map(
		(dep) =>
			`- **${dep.type}**: ${dep.id}${dep.duration ? ` (${dep.duration})` : ""}`,
	)
	.join("\n")}`
		: ""
}

### Implementation Approach

_Describe the technical approach..._

### Acceptance Criteria

_Define the acceptance criteria..._

### Related Stories

_Stories linked to this feature will appear here automatically..._
`;
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const data: CreateFeatureRequest = await request.json();

		// Validate required fields
		const requiredFields = ["title", "description", "enhancement", "priority"];

		for (const field of requiredFields) {
			if (!data[field as keyof CreateFeatureRequest]) {
				return new Response(
					JSON.stringify({ error: `Missing required field: ${field}` }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Validate priority value
		if (!["must", "should", "could", "wont"].includes(data.priority)) {
			return new Response(JSON.stringify({ error: "Invalid priority value" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate size if provided
		if (data.size && !["XS", "S", "M", "L", "XL"].includes(data.size)) {
			return new Response(JSON.stringify({ error: "Invalid size value" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Generate slug and filename
		const slug = generateSlug(data.title);
		const filename = `${slug}.mdx`;

		// Generate content
		const content = generateMarkdownContent(data);

		// Write file
		const filePath = join(
			process.cwd(),
			"src",
			"content",
			"features",
			filename,
		);
		await writeFile(filePath, content, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				filename,
				slug,
				message: "Feature created successfully",
			}),
			{
				status: 201,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error creating feature:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create feature",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		const { slug } = await request.json();

		if (!slug) {
			return new Response(JSON.stringify({ error: "Slug is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Find the feature file
		const featuresDir = join(process.cwd(), "src", "content", "features");
		const files = await readdir(featuresDir);
		const matchingFile = files.find((file) => file.includes(slug));

		if (!matchingFile) {
			return new Response(JSON.stringify({ error: "Feature not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Delete the file
		const filePath = join(featuresDir, matchingFile);
		await unlink(filePath);

		return new Response(
			JSON.stringify({
				success: true,
				message: "Feature deleted successfully",
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error deleting feature:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to delete feature",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const GET: APIRoute = async () => {
	return new Response(
		JSON.stringify({
			message: "Features API endpoint",
			endpoints: {
				"POST /api/features": "Create a new feature",
				"DELETE /api/features": "Delete a feature by slug",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
