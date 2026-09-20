import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
	closeRoom,
	createSeededRoom,
	openAudience,
	openContestant,
	openDisplay,
	start,
} from "./support/arcade";

async function expectNoSeriousAxeFindings(page: Page): Promise<void> {
	const results = await new AxeBuilder({ page }).analyze();
	const blocking = results.violations.filter(
		(violation) => violation.impact === "serious" || violation.impact === "critical",
	);
	expect(blocking).toEqual([]);
}

test("public navigation is keyboard reachable and axe-clean", async ({ page }) => {
	for (const path of ["/", "/join", "/leaderboards"] as const) {
		await page.goto(path);
		await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
		await expectNoSeriousAxeFindings(page);
	}

	await page.goto("/join");
	await page.keyboard.press("Tab");
	await expect(page.locator(":focus-visible")).toBeVisible();
});

test("all live roles are axe-clean during gameplay", async ({ browser, page, request }) => {
	const room = await createSeededRoom(page, request, "merge-conflict");
	try {
		const contestant = await openContestant(browser, room, {
			name: "A11y Player",
			teamId: "team-red",
		});
		const audience = await openAudience(browser, room);
		const display = await openDisplay(browser, room);
		await start(room);

		for (const rolePage of [room.host, contestant, audience, display]) {
			await expectNoSeriousAxeFindings(rolePage);
		}
	} finally {
		await closeRoom(room);
	}
});

test("reduced motion disables non-essential long animation", async ({ page }) => {
	await page.goto("/");
	const offenders = await page.locator("body *").evaluateAll((elements) =>
		elements
			.map((element) => {
				const style = getComputedStyle(element);
				const durations = `${style.animationDuration},${style.transitionDuration}`
					.split(",")
					.map((value) => Number.parseFloat(value) || 0);
				return {
					tag: element.tagName,
					id: element.id,
					maxDurationSeconds: Math.max(...durations),
				};
			})
			.filter((item) => item.maxDurationSeconds > 0.1),
	);
	expect(offenders).toEqual([]);
});
