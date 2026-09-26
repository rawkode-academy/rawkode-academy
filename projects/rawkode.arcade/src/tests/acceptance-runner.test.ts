import { expect, test } from "bun:test";
import { reportsSkippedTests } from "../../scripts/reported-skips";

test("acceptance guard distinguishes reporter outcomes from test names", () => {
	for (const text of ["(skip) unfinished", "Tests 2 passed | 1 skipped (3)", "1 pending", "2 todo", "ok 2 - example # SKIP unavailable"]) expect(reportsSkippedTests(text)).toBe(true);
	for (const text of ["(pass) host can skip a no-buzz round", "✓ retains pending admissions", "0 skipped", "10 passed (10)"]) expect(reportsSkippedTests(text)).toBe(false);
});
