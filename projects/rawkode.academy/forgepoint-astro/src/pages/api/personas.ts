import type { APIRoute } from "astro";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// API endpoints are development-only in static build mode

interface CreatePersonaRequest {
	title: string;
	description: string;
	goals: string[];
	painPoints: string[];
	context: string;
	role?: string;
	experience?: "beginner" | "intermediate" | "expert" | "varied";
}

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
}

function generateMarkdownContent(data: CreatePersonaRequest): string {
	const frontmatter: Record<string, unknown> = {
		title: data.title,
		description: data.description,
		goals: data.goals,
		painPoints: data.painPoints,
		context: data.context,
	};

	if (data.role) {
		frontmatter.role = data.role;
	}

	if (data.experience) {
		frontmatter.experience = data.experience;
	}

	const yaml = Object.entries(frontmatter)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return `${key}:\n${value.map((item) => `  - ${JSON.stringify(item)}`).join("\n")}`;
			}
			return `${key}: ${JSON.stringify(value)}`;
		})
		.join("\n");

	return `---
${yaml}
---

## Persona Overview

${data.description}

### Context

${data.context}

${data.role ? `### Role\n\n${data.role}` : ""}

${data.experience ? `### Experience Level\n\n${data.experience}` : ""}

### Goals

${data.goals.map((goal) => `- ${goal}`).join("\n")}

### Pain Points

${data.painPoints.map((pain) => `- ${pain}`).join("\n")}

### User Journey

_Describe this persona's typical journey through the product..._

### Quotes

_Add some representative quotes from this persona..._

### Behaviors

_Describe typical behaviors and preferences..._
`;
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const data: CreatePersonaRequest = await request.json();

		// Validate required fields
		const requiredFields = [
			"title",
			"description",
			"goals",
			"painPoints",
			"context",
		];

		for (const field of requiredFields) {
			if (!data[field as keyof CreatePersonaRequest]) {
				return new Response(
					JSON.stringify({ error: `Missing required field: ${field}` }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Validate arrays
		if (!Array.isArray(data.goals) || data.goals.length === 0) {
			return new Response(
				JSON.stringify({ error: "Goals must be a non-empty array" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (!Array.isArray(data.painPoints) || data.painPoints.length === 0) {
			return new Response(
				JSON.stringify({ error: "Pain points must be a non-empty array" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate experience if provided
		if (
			data.experience &&
			!["beginner", "intermediate", "expert", "varied"].includes(
				data.experience,
			)
		) {
			return new Response(
				JSON.stringify({ error: "Invalid experience value" }),
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
			"personas",
			filename,
		);
		await writeFile(filePath, content, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				filename,
				slug,
				message: "Persona created successfully",
			}),
			{
				status: 201,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error creating persona:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create persona",
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

		// Find the persona file
		const personasDir = join(process.cwd(), "src", "content", "personas");
		const files = await readdir(personasDir);
		const matchingFile = files.find((file) => file.includes(slug));

		if (!matchingFile) {
			return new Response(JSON.stringify({ error: "Persona not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Delete the file
		const filePath = join(personasDir, matchingFile);
		await unlink(filePath);

		return new Response(
			JSON.stringify({
				success: true,
				message: "Persona deleted successfully",
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error deleting persona:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to delete persona",
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
			message: "Personas API endpoint",
			endpoints: {
				"POST /api/personas": "Create a new persona",
				"DELETE /api/personas": "Delete a persona by slug",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
