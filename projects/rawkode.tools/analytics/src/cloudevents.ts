import { CloudEvent, ValidationError } from "cloudevents";

export type { CloudEvent };

export type ValidationResult =
	| { valid: true; event: CloudEvent }
	| { valid: false; error: string };

export function validateCloudEvent(input: unknown): ValidationResult {
	if (!input || typeof input !== "object") {
		return { valid: false, error: "Event must be an object" };
	}

	try {
		const event = new CloudEvent(input as Record<string, unknown>, true);
		event.validate();
		return { valid: true, event };
	} catch (error) {
		if (error instanceof ValidationError) {
			return { valid: false, error: error.message };
		}
		return { valid: false, error: "Invalid CloudEvent" };
	}
}
