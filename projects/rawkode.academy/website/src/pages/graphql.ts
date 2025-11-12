export const prerender = false;

import type { APIRoute } from "astro";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../subgraph/schema";

// Single federated subgraph endpoint for the website.
// Compose additional domain modules under src/subgraph/domains/*
const yoga = createYoga({
	schema: getSchema(),
	graphqlEndpoint: "/graphql",
});

export const GET: APIRoute = async ({ request }) => {
	const res = await yoga.fetch(request);
	// Ensure we return an Astro-compatible Response instance
	const headers = new Headers(res.headers as any);
	return new Response(res.body, { status: res.status, headers });
};

export const POST: APIRoute = async ({ request }) => {
	const res = await yoga.fetch(request);
	const headers = new Headers(res.headers as any);
	return new Response(res.body, { status: res.status, headers });
};
