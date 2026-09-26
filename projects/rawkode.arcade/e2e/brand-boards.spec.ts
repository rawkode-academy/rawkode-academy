import { expect, test } from "@playwright/test";
import {
	assertNoSecretInBrowser,
	closeRoom,
	createSeededRoom,
	openContestant,
	openDisplay,
	start,
	type GameId,
} from "./support/arcade";

const formats: readonly {
	game: GameId;
	board: string;
	/** First-round answer that must remain absent before the host reveal. */
	hiddenAnswer: string;
	/** Principal choices are intentionally public to contestants. */
	allowContestantAnswer?: boolean;
}[] = [
	{ game: "merge-conflict", board: "merge-board", hiddenAnswer: "It works on my machine" },
	{ game: "spinlock", board: "spin-board", hiddenAnswer: "EVENTUAL CONSISTENCY" },
	{
		game: "principal-engineer",
		board: "principal-board",
		hiddenAnswer: "PUT",
		allowContestantAnswer: true,
	},
	{ game: "race-condition", board: "race-board", hiddenAnswer: "queue" },
	{ game: "ten-nines", board: "ten-nines-board", hiddenAnswer: "200" },
	{ game: "null-pointer", board: "null-pointer-board", hiddenAnswer: "Java" },
];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
	const dimensions = await page.evaluate(() => ({
		viewport: window.innerWidth,
		document: document.documentElement.scrollWidth,
		body: document.body.scrollWidth,
	}));
	expect(
		Math.max(dimensions.document, dimensions.body),
		`mobile document overflowed ${dimensions.viewport}px viewport`,
	).toBeLessThanOrEqual(dimensions.viewport);
}

for (const format of formats) {
	test(`${format.game}: branded board is distinct, contained, and answer-safe`, async ({
		browser,
		page,
		request,
	}) => {
		const room = await createSeededRoom(page, request, format.game);
		try {
			const contestant = await openContestant(browser, room, {
				name: `${format.game} mobile`,
				teamId: "team-red",
			});
			await contestant.setViewportSize({ width: 320, height: 720 });
			const display = await openDisplay(browser, room);

			await start(room);

			const displayBoard = display.getByTestId(format.board);
			const contestantBoard = contestant.getByTestId(format.board);
			await expect(displayBoard).toBeVisible();
			await expect(contestantBoard).toBeVisible();
			await expect(display.locator("[data-game-board]")).toHaveCount(1);
			await expect(contestant.locator("[data-game-board]")).toHaveCount(1);
			await expectNoHorizontalOverflow(contestant);

			// The display has no contestant-facing choices, so this checks the
			// broadcast presenter cannot reveal the seeded answer prematurely.
			await expect(displayBoard).not.toContainText(format.hiddenAnswer, {
				ignoreCase: true,
			});
			await expect(display.getByTestId("revealed-answer")).toHaveCount(0);
			if (!format.allowContestantAnswer)
				await expect(contestantBoard).not.toContainText(format.hiddenAnswer, {
					ignoreCase: true,
				});
			await expect(contestant.getByTestId("revealed-answer")).toHaveCount(0);
			await assertNoSecretInBrowser(contestant, room.privateMarker);
			await assertNoSecretInBrowser(display, room.privateMarker);
		} catch (error) {
			console.error("Live-room scenario failed before cleanup:", error);
			throw error;
		} finally {
			await closeRoom(room);
		}
	});
}
