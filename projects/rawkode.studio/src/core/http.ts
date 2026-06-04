import type { StudioApiResponse } from "./types";

export function jsonResponse<T>(data: T, init?: ResponseInit): Response {
	return Response.json({ ok: true, data } satisfies StudioApiResponse<T>, init);
}

export function errorResponse(error: string, status = 400): Response {
	return Response.json({ ok: false, error } satisfies StudioApiResponse<never>, { status });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
	try {
		return await request.json() as T;
	} catch {
		throw new Error("Request body must be valid JSON");
	}
}
