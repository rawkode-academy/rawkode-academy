import { Hono } from "hono";
import { auth } from "./middleware/auth";
import { logging } from "./middleware/logging";
import { validateRequest } from "./middleware/validation";
import { handleRPC } from "./router";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logging);

// Health check endpoint
app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		service: "rpc-gateway",
		timestamp: new Date().toISOString(),
	});
});

// RPC endpoints with middleware chain for all HTTP methods
// Authentication is required for all RPC calls
app.post("/rpc", auth, validateRequest, handleRPC);
app.get("/rpc", auth, validateRequest, handleRPC);
app.put("/rpc", auth, validateRequest, handleRPC);
app.patch("/rpc", auth, validateRequest, handleRPC);
app.delete("/rpc", auth, validateRequest, handleRPC);

// Service discovery endpoint
app.get("/services", (c) => {
	// This could be enhanced to dynamically check which services are available
	return c.json({
		services: {
			"casting-credits": {
				methods: ["POST"],
				description: "Manage casting credits for videos",
			},
		},
	});
});

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: {
				code: "NOT_FOUND",
				message: "Endpoint not found",
			},
		},
		404,
	);
});

// Error handler
app.onError((err, c) => {
	console.error("Unhandled error:", err);
	return c.json(
		{
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
			},
		},
		500,
	);
});

export default app;
