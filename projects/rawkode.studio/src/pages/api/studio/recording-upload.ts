import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import {
	json,
	operationErrorResponse,
	requestHasAllowedOrigin,
} from "../../../server/http";
import {
	abortStudioRecordingUpload,
	completeStudioRecordingUpload,
	createStudioRecordingUpload,
	uploadStudioRecordingPart,
} from "../../../server/operations";

const sourceFormats = new Set(["webm"]);

function parseSourceFormat(value: string | undefined | null): "webm" | null {
	return value && sourceFormats.has(value) ? "webm" : null;
}

function unauthorized() {
	return json({ error: "Sign in with rawkode.academy identity." }, 401);
}

function crossOrigin() {
	return json({ error: "Cross-origin Studio mutations are not allowed." }, 403);
}

function invalidRecordingUpload() {
	return json({ error: "A complete recording upload request is required." }, 400);
}

function parsePartNumber(value: string | null): number {
	return Number.parseInt(value ?? "", 10);
}

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) return unauthorized();
	if (!requestHasAllowedOrigin(request)) return crossOrigin();

	const body = (await request.json().catch(() => null)) as {
		action?: "complete" | "create";
		parts?: Array<{ etag?: string; partNumber?: number }>;
		recordingId?: string;
		sessionId?: string;
		sourceFormat?: string;
		uploadId?: string;
	} | null;
	const action = body?.action ?? "create";
	const sourceFormat = parseSourceFormat(body?.sourceFormat);
	if (!body?.sessionId || !sourceFormat) {
		return invalidRecordingUpload();
	}

	try {
		if (action === "complete") {
			if (!body.recordingId || !body.uploadId || !body.parts) {
				return invalidRecordingUpload();
			}
			const result = await completeStudioRecordingUpload(
				env as StudioEnv,
				locals.user,
				{
					parts: body.parts.map((part) => ({
						etag: part.etag ?? "",
						partNumber: part.partNumber ?? 0,
					})),
					recordingId: body.recordingId,
					sessionId: body.sessionId,
					sourceFormat,
					uploadId: body.uploadId,
				},
			);
			return json(result);
		}

		if (action !== "create") {
			return invalidRecordingUpload();
		}
		const upload = await createStudioRecordingUpload(
			env as StudioEnv,
			locals.user,
			{
				sessionId: body.sessionId,
				sourceFormat,
			},
		);
		return json(upload);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};

export const PUT: APIRoute = async ({ locals, request }) => {
	if (!locals.user) return unauthorized();
	if (!requestHasAllowedOrigin(request)) return crossOrigin();
	if (!request.body) return invalidRecordingUpload();

	const url = new URL(request.url);
	const sourceFormat = parseSourceFormat(url.searchParams.get("sourceFormat"));
	const sessionId = url.searchParams.get("sessionId");
	const recordingId = url.searchParams.get("recordingId");
	const uploadId = url.searchParams.get("uploadId");
	if (!sessionId || !recordingId || !uploadId || !sourceFormat) {
		return invalidRecordingUpload();
	}

	try {
		const part = await uploadStudioRecordingPart(
			env as StudioEnv,
			locals.user,
			{
				body: request.body,
				partNumber: parsePartNumber(url.searchParams.get("partNumber")),
				recordingId,
				sessionId,
				sourceFormat,
				uploadId,
			},
		);
		return json(part);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};

export const DELETE: APIRoute = async ({ locals, request }) => {
	if (!locals.user) return unauthorized();
	if (!requestHasAllowedOrigin(request)) return crossOrigin();

	const url = new URL(request.url);
	const sourceFormat = parseSourceFormat(url.searchParams.get("sourceFormat"));
	const sessionId = url.searchParams.get("sessionId");
	const recordingId = url.searchParams.get("recordingId");
	const uploadId = url.searchParams.get("uploadId");
	if (!sessionId || !recordingId || !uploadId || !sourceFormat) {
		return invalidRecordingUpload();
	}

	try {
		const result = await abortStudioRecordingUpload(
			env as StudioEnv,
			locals.user,
			{
				recordingId,
				sessionId,
				sourceFormat,
				uploadId,
			},
		);
		return json(result);
	} catch (error) {
		const response = operationErrorResponse(error);
		if (response) return response;
		throw error;
	}
};
