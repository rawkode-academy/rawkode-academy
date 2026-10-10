import { createId } from "@paralleldrive/cuid2";

const CUID2_PATTERN = /^[a-z][a-z0-9]{23}$/;

export function createReviewId(): string {
	return createId();
}

export function isReviewId(value: unknown): value is string {
	return typeof value === "string" && CUID2_PATTERN.test(value);
}
