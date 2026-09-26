import { describe, expect, test } from "vitest";
import { viewScopeHeaders } from "../src/lib/view-scope";

describe("live view downscoping", () => {
	test("preserves an audience tab's scoped role for recovery requests", () => {
		expect(viewScopeHeaders("audience")).toEqual({
			"x-arcade-view-role": "audience",
		});
		expect(viewScopeHeaders("display")).toEqual({
			"x-arcade-view-role": "display",
		});
		expect(viewScopeHeaders()).toEqual({});
	});
});
