import type { APIRoute } from "astro";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

interface CreateActivityRequest {
	title: string;
	description: string;
	order: number;
	outcome: string;
	personas: string[];
	metrics?: Array<{
		name: string;
		target: string;
	}>;
}

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
}

function generateMarkdownContent(data: CreateActivityRequest): string {
	const frontmatter: Record<string, unknown> = {
		title: data.title,
		description: data.description,
		order: data.order,
		outcome: data.outcome,
		personas: data.personas,
	};

	if (data.metrics && data.metrics.length > 0) {
		frontmatter.metrics = data.metrics;
	}

	const yaml = Object.entries(frontmatter)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				if (key === "personas") {
					return `${key}:\n${value.map((item) => `  - ${JSON.stringify(item)}`).join("\n")}`;
				} else if (key === "metrics") {
					return `${key}:\n${(value as Array<{ name: string; target: string }>)
						.map(
							(metric) =>
								`  - name: ${JSON.stringify(metric.name)}\n    target: ${JSON.stringify(metric.target)}`,
						)
						.join("\n")}`;
				}
			}
			return `${key}: ${JSON.stringify(value)}`;
		})
		.join("\n");

	return `---
${yaml}
---

## Activity Overview

${data.description}

### Expected Outcome

${data.outcome}

### Target Personas

${data.personas.map((p) => `- ${p}`).join("\n")}

${
	data.metrics && data.metrics.length > 0
		? `### Success Metrics

${data.metrics.map((m) => `- **${m.name}**: ${m.target}`).join("\n")}`
		: ""
}

### User Journey

_Describe the user journey through this activity..._

### Related Stories

_Stories will be automatically linked based on their activityId..._
`;
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const data: CreateActivityRequest = await request.json();

		// Validate required fields
		const requiredFields = [
			"title",
			"description",
			"order",
			"outcome",
			"personas",
		];

		for (const field of requiredFields) {
			if (!data[field as keyof CreateActivityRequest]) {
				return new Response(
					JSON.stringify({ error: `Missing required field: ${field}` }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Validate order is a positive integer
		if (!Number.isInteger(data.order) || data.order < 1) {
			return new Response(
				JSON.stringify({ error: "Order must be a positive integer" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate personas is an array
		if (!Array.isArray(data.personas) || data.personas.length === 0) {
			return new Response(
				JSON.stringify({ error: "Personas must be a non-empty array" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
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
			"activities",
			filename,
		);
		await writeFile(filePath, content, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				filename,
				slug,
				message: "Activity created successfully",
			}),
			{
				status: 201,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error creating activity:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create activity",
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

		// Find the activity file
		const activitiesDir = join(process.cwd(), "src", "content", "activities");
		const files = await readdir(activitiesDir);
		const matchingFile = files.find((file) => file.includes(slug));

		if (!matchingFile) {
			return new Response(JSON.stringify({ error: "Activity not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Delete the file
		const filePath = join(activitiesDir, matchingFile);
		await unlink(filePath);

		return new Response(
			JSON.stringify({
				success: true,
				message: "Activity deleted successfully",
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error deleting activity:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to delete activity",
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
			message: "Activities API endpoint",
			endpoints: {
				"POST /api/activities": "Create a new activity",
				"DELETE /api/activities": "Delete an activity by slug",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
