class ApiResponseError extends Error {
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
