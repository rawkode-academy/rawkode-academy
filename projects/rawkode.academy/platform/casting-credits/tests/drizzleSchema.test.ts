import { describe, it, expect } from "bun:test";
import * as schema from "../data-model/schema";

describe("Database Schema", () => {
	it("should have the castingCreditsTable defined", () => {
		expect(schema.castingCreditsTable).toBeDefined();
	});
});
