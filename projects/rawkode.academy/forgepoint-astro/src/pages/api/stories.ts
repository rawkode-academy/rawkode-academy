import type { APIRoute } from "astro";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// API endpoints are development-only in static build mode

interface CreateStoryRequest {
	title: string;
	description: string;
	personaId: string;
	iWant: string;
	soThat: string;
	acceptanceCriteria: string[];
	priority: "must" | "should" | "could" | "wont";
	size?: "XS" | "S" | "M" | "L" | "XL";
	activityId: string;
	featureId?: string;
}

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
}

function generateMarkdownContent(data: CreateStoryRequest): string {
	const frontmatter = {
		title: data.title,
		description: data.description,
		personaId: data.personaId,
		iWant: data.iWant,
		soThat: data.soThat,
		acceptanceCriteria: data.acceptanceCriteria,
		priority: data.priority,
		activityId: data.activityId,
		...(data.size && { size: data.size }),
		...(data.featureId && { featureId: data.featureId }),
	};

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

## Story Details

This story was created via the ForgePoint API.

### Implementation Notes

_Add implementation details here..._

### Technical Considerations

_Add technical considerations here..._
`;
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Check content type
		const contentType = request.headers.get("content-type");
		console.log("Received content-type:", contentType);
		console.log("All headers:", Object.fromEntries(request.headers.entries()));

		const data: CreateStoryRequest = await request.json();

		// Validate required fields
		const requiredFields = [
			"title",
			"description",
			"personaId",
			"iWant",
			"soThat",
			"acceptanceCriteria",
			"priority",
			"activityId",
		];

		for (const field of requiredFields) {
			if (!data[field]) {
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

		// Generate slug and filename
		const slug = generateSlug(data.title);
		const timestamp = Date.now();
		const filename = `${slug}-${timestamp}.mdx`;

		// Generate content
		const content = generateMarkdownContent(data);

		// Write file
		const filePath = join(process.cwd(), "src", "content", "stories", filename);
		await writeFile(filePath, content, "utf-8");

		return new Response(
			JSON.stringify({
				success: true,
				filename,
				slug: `${slug}-${timestamp}`,
				message: "Story created successfully",
			}),
			{
				status: 201,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error creating story:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create story",
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
			message: "Stories API endpoint",
			endpoints: {
				"POST /api/stories": "Create a new story",
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
