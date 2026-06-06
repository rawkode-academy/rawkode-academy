import { StudioOperationError } from "./operations";

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function requestHasAllowedOrigin(request: Request): boolean {
	const origin = request.headers.get("Origin");
	if (!origin) return true;

	return new URL(origin).origin === new URL(request.url).origin;
}

export function operationErrorResponse(error: unknown): Response | null {
	if (error instanceof StudioOperationError) {
		return json({ error: error.message }, error.status);
	}
	return null;
}
