import { describe, expect, it } from "vitest";
import { createSessionInputSchema } from "./createSessionInput";

describe("create session action input", () => {
	it("keeps Test as the default without requiring production confirmation", () => {
		expect(
			createSessionInputSchema.parse({
				videoId: "video-1",
			}),
		).toEqual({
			streamEnvironment: "test",
			videoId: "video-1",
		});
	});

	it("preserves the exact PROD confirmation passed to the session operation", () => {
		expect(
			createSessionInputSchema.parse({
				prodConfirmation: "PROD",
				streamEnvironment: "prod",
				videoId: "video-1",
			}),
		).toEqual({
			prodConfirmation: "PROD",
			streamEnvironment: "prod",
			videoId: "video-1",
		});
	});

	it("does not normalize a non-exact production confirmation", () => {
		expect(
			createSessionInputSchema.parse({
				prodConfirmation: " PROD ",
				streamEnvironment: "prod",
				videoId: "video-1",
			}).prodConfirmation,
		).toBe(" PROD ");
	});
});
