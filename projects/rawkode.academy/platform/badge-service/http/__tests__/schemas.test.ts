import { describe, expect, it } from "vitest";
import { IssueBadgeRequestSchema } from "../schemas.js";

const validRequest = {
	userId: "user_123",
	recipientEmail: "learner@example.com",
	achievementType: "course-completion",
	achievementName: "Kubernetes Basics",
	achievementDescription: "Completed the Kubernetes Basics course",
};

describe("IssueBadgeRequestSchema", () => {
	it("should parse an ISO validUntil string into a Date", () => {
		const parsed = IssueBadgeRequestSchema.parse({
			...validRequest,
			validUntil: "2027-01-01T00:00:00Z",
		});

		expect(parsed.validUntil).toBeInstanceOf(Date);
		expect(parsed.validUntil?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
	});

	it("should reject null validUntil instead of coercing to 1970", () => {
		const parsed = IssueBadgeRequestSchema.safeParse({
			...validRequest,
			validUntil: null,
		});

		expect(parsed.success).toBe(false);
	});

	it("should reject non-ISO validUntil strings", () => {
		const parsed = IssueBadgeRequestSchema.safeParse({
			...validRequest,
			validUntil: "not-a-date",
		});

		expect(parsed.success).toBe(false);
	});
});
