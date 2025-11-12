export interface ApiError {
	message: string;
	code?: string;
	status?: number;
	details?: unknown;
}

export class ApiResponseError extends Error {
	public readonly status: number;
	public readonly code?: string;
	public readonly details?: unknown;

	constructor(
		message: string,
		status: number,
		code?: string,
		details?: unknown,
	) {
		super(message);
		this.name = "ApiResponseError";
		this.status = status;
		if (code !== undefined) {
			this.code = code;
		}
		this.details = details;
	}
}

export async function handleApiResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let errorMessage = `Request failed with status ${response.status}`;
		let errorCode: string | undefined;
		let errorDetails: unknown;

		try {
			const errorData: {
				error?: string;
				message?: string;
				code?: string;
				details?: unknown;
			} = await response.json();
			if (errorData.error) {
				errorMessage = errorData.error;
			} else if (errorData.message) {
				errorMessage = errorData.message;
			}
			errorCode = errorData.code;
			errorDetails = errorData.details;
		} catch {
			// Failed to parse error response, use default message
		}

		throw new ApiResponseError(
			errorMessage,
			response.status,
			errorCode,
			errorDetails,
		);
	}

	try {
		return await response.json();
	} catch (error) {
		throw new Error("Failed to parse response data");
	}
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof ApiResponseError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return "An unexpected error occurred";
}

export function isNetworkError(error: unknown): boolean {
	if (error instanceof TypeError && error.message.includes("fetch")) {
		return true;
	}

	if (
		error instanceof Error &&
		(error.message.includes("NetworkError") ||
			error.message.includes("Failed to fetch") ||
			error.message.includes("Network request failed"))
	) {
		return true;
	}

	return false;
}

export function logError(
	error: unknown,
	context?: Record<string, unknown>,
): void {
	console.error("Error occurred:", error, context);

	const enableErrorCapture =
		(import.meta as any).env?.PUBLIC_CAPTURE_ERRORS === "true";
	if (
		enableErrorCapture &&
		typeof window !== "undefined" &&
		(window as any).posthog
	) {
		const ph = (window as any).posthog;
		if (error instanceof Error) {
			ph.capture("js_error", {
				name: error.name,
				message: error.message,
				stack: error.stack,
				...context,
			});
		} else {
			ph.capture("js_error", { message: String(error), ...context });
		}
	}
}
