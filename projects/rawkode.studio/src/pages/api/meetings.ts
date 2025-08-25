import type { APIRoute } from "astro";
import {
	type CreateMeetingOptions,
	RealtimeKitClient,
} from "@/lib/realtime-kit/client";
import { requireDirectorRole } from "@/lib/auth/auth-utils";

export const GET: APIRoute = async ({ locals, url }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		// Create RealtimeKit client
		const client = new RealtimeKitClient();

		// Get pagination parameters from query string
		const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
		const perPage = Number.parseInt(
			url.searchParams.get("per_page") || "10",
			10,
		);
		const search = url.searchParams.get("search") || undefined;

		// Fetch meetings with pagination
		const response = await client.listMeetings({
			page_no: page,
			per_page: perPage,
			search,
		});

		return new Response(JSON.stringify(response), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to fetch meetings:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch meetings",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};

export const POST: APIRoute = async ({ locals, request }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		// Parse request body
		const body = (await request.json()) as CreateMeetingOptions;

		// Create RealtimeKit client
		const client = new RealtimeKitClient();

		// Create the meeting
		const meeting = await client.createMeeting(body);

		return new Response(JSON.stringify(meeting), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to create meeting:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create meeting",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
