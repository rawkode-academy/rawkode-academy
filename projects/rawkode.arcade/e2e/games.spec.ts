import { expect, test } from "@playwright/test";
import {
	assertNoSecretInBrowser,
	closeRoom,
	completeGame,
	createSeededRoom,
	openAudience,
	openContestant,
	openDisplay,
	start,
} from "./support/arcade";

test("Merge Conflict: teams predict a survey answer and the host reveals it", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "merge-conflict");
	try {
		const contestant = await openContestant(browser, room, {
			name: "Ada",
			teamId: "team-red",
		});
		const audience = await openAudience(browser, room);
		const display = await openDisplay(browser, room);
		await start(room);

		await expect(contestant.getByTestId("question")).toBeVisible();
		await contestant.getByTestId("answer-input").fill("definitely not a seeded answer");
		await contestant.getByTestId("submit-answer").click();
		await expect(contestant.getByTestId("answer-input")).toHaveValue("");
		await expect(contestant.getByTestId("submit-answer")).toBeDisabled();
		await contestant.getByTestId("answer-input").fill("It works on my machine");
		await expect(contestant.getByTestId("submit-answer")).toBeEnabled();
		await contestant.getByTestId("submit-answer").click();
		await audience.getByTestId("answer-input").fill("It works on my machine");
		await audience.getByTestId("submit-answer").click();
		await expect(room.host.getByTestId("audience-aggregate")).toContainText("1 authoritative");
		await assertNoSecretInBrowser(contestant, room.privateMarker);
		await assertNoSecretInBrowser(display, room.privateMarker);
		await contestant.reload();
		await expect(contestant.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
		await assertNoSecretInBrowser(contestant, room.privateMarker);

		await room.host.getByTestId("reveal-answer").click();
		await expect(display.getByTestId("revealed-answer")).toContainText("It works on my machine");
		await expect(display.getByTestId("score-team-red")).not.toHaveText("0");

		await room.host.getByTestId("advance-phase").click();
		await expect(contestant.getByTestId("question")).toContainText("live demo");
		await expect(contestant.getByTestId("submit-answer")).toBeDisabled();
		await contestant.getByTestId("answer-input").fill("Environment variables");
		await contestant.getByTestId("submit-answer").click();
		await expect(audience.getByTestId("submit-answer")).toBeDisabled();
		await audience.getByTestId("answer-input").fill("Wi-Fi");
		await audience.getByTestId("submit-answer").click();
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});

test("Spinlock: a contestant solves the seeded developer phrase", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "spinlock");
	try {
		const contestant = await openContestant(browser, room, {
			name: "Grace",
			teamId: "team-red",
		});
		const display = await openDisplay(browser, room);
		await start(room);

		await expect(display.getByTestId("spin-board")).toBeVisible();
		await room.host.getByTestId("spin-wheel").click();
		await room.host.getByTestId("spin-letter").fill("e");
		await room.host.getByTestId("guess-letter").click();
		await expect(display.getByTestId("spin-board")).toContainText("E");
		await contestant.getByTestId("answer-input").fill("eventual consistency");
		await contestant.getByTestId("submit-answer").click();

		await expect(display.getByTestId("spin-board")).toContainText(
			"EVENTUAL CONSISTENCY",
		);
		await expect(display.getByTestId("score-team-red")).not.toHaveText("0");
		await assertNoSecretInBrowser(contestant, room.privateMarker);
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});

test("Principal Engineer: a contestant advances through a question", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "principal-engineer");
	try {
		const contestant = await openContestant(browser, room, {
			name: "Margaret",
			teamId: "team-red",
		});
		const audience = await openAudience(browser, room);
		const display = await openDisplay(browser, room);
		await start(room);

		await room.host.getByTestId("lifeline-fifty-fifty").click();
		await expect(contestant.locator('[data-testid^="answer-option-"]')).toHaveCount(2);
		await expect(contestant.getByTestId("answer-option-2")).toBeVisible();
		await expect(display.getByTestId("principal-lifeline-effect")).toContainText("50:50 removed 2 options");
		await room.host.getByTestId("lifeline-ask-audience").click();
		await contestant.getByTestId("answer-option-2").click();
		await contestant.getByTestId("submit-answer").click();
		await audience.getByTestId("answer-option-2").click();
		await audience.getByTestId("submit-answer").click();
		await expect(room.host.getByTestId("audience-aggregate")).toContainText("1 authoritative");
		await expect(display.getByTestId("principal-lifeline-effect")).toContainText("2: 1");
		await assertNoSecretInBrowser(audience, room.privateMarker);
		await room.host.getByTestId("advance-phase").click();
		await expect(display.getByTestId("score-team-red")).toHaveText("100");
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});

test("Race Condition: simultaneous contestants produce one buzzer winner", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "race-condition");
	try {
		const red = await openContestant(browser, room, {
			name: "Radia",
			teamId: "team-red",
		});
		const blue = await openContestant(browser, room, {
			name: "Barbara",
			teamId: "team-blue",
		});
		const display = await openDisplay(browser, room);
		await start(room);

		await Promise.all([red.getByTestId("buzzer").click(), blue.getByTestId("buzzer").click()]);
		await expect(display.getByTestId("buzzer-winner")).toHaveCount(1);
		await expect(display.getByTestId("buzzer-winner")).toHaveText(/Radia|Barbara/);
		await assertNoSecretInBrowser(display, room.privateMarker);
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});

test("Ten Nines: a team completes the seeded technical list", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "ten-nines");
	try {
		const contestant = await openContestant(browser, room, {
			name: "Evelyn",
			teamId: "team-red",
		});
		const display = await openDisplay(browser, room);
		await start(room);

		for (const answer of ["200", "201", "204", "301", "400", "401", "403", "404", "429", "500"]) {
			await contestant.getByTestId("answer-input").fill(answer);
			await contestant.getByTestId("submit-answer").click();
		}
		await expect(display.getByTestId("revealed-answer")).toContainText("200");
		await expect(display.getByTestId("score-team-red")).not.toHaveText("0");
		await room.host.getByTestId("advance-phase").click();
		await expect(contestant.getByTestId("question")).toContainText("Git");
		await assertNoSecretInBrowser(contestant, room.privateMarker);
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});

test("Null Pointer: audience rarity freezes before contestant scoring", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "null-pointer");
	try {
		const rareContestant = await openContestant(browser, room, {
			name: "Anita",
			teamId: "team-red",
		});
		const commonContestant = await openContestant(browser, room, {
			name: "Frances",
			teamId: "team-blue",
		});
		const audienceOne = await openAudience(browser, room);
		const audienceTwo = await openAudience(browser, room);
		const audienceThree = await openAudience(browser, room);
		const lateAudience = await openAudience(browser, room);
		const display = await openDisplay(browser, room);
		await start(room);

		await audienceOne.getByTestId("answer-input").fill("Java");
		await audienceOne.getByTestId("submit-answer").click();
		await audienceTwo.getByTestId("answer-input").fill("Java");
		await audienceTwo.getByTestId("submit-answer").click();
		await audienceThree.getByTestId("answer-input").fill("Elixir");
		await audienceThree.getByTestId("submit-answer").click();
		// Freeze only after the authoritative room has aggregated all shards.
		await expect(room.host.getByTestId("audience-aggregate")).toContainText("3 authoritative");
		await room.host.getByTestId("freeze-distribution").click();
		await expect(display.getByTestId("audience-distribution")).toBeVisible();
		await expect(display.getByTestId("audience-bin-java")).toHaveText("Java: 2");
		await expect(display.getByTestId("audience-bin-elixir")).toHaveText("Elixir: 1");
		const frozenDistribution = await display.getByTestId("audience-distribution").innerText();
		await expect(audienceOne.getByTestId("submit-answer")).toBeDisabled();
		const late = await lateAudience.evaluate(
			async ({ roomId }) => {
				const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/commands`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						v: 1,
						id: "e2e-late-null-pointer-answer",
						type: "audience.vote",
						expectedVersion: 0,
						sentAt: new Date().toISOString(),
						payload: { promptId: "null-0", choice: "Elixir" },
					}),
				});
				return { status: response.status, body: await response.json() };
			},
			{ roomId: room.roomId },
		);
		expect(late.status).toBe(409);
		expect(late.body).toMatchObject({
			error: { code: "DISTRIBUTION_FROZEN" },
		});

		await rareContestant.getByTestId("answer-input").fill("Elixir");
		await rareContestant.getByTestId("submit-answer").click();
		await commonContestant.getByTestId("answer-input").fill("Java");
		await commonContestant.getByTestId("submit-answer").click();
		await room.host.getByTestId("reveal-answer").click();
		expect(await display.getByTestId("audience-distribution").innerText()).toBe(frozenDistribution);
		const rareScore = Number(
			(await display.getByTestId("score-team-red").innerText()).replace(/\D/g, ""),
		);
		const commonScore = Number(
			(await display.getByTestId("score-team-blue").innerText()).replace(/\D/g, ""),
		);
		expect(rareScore).toBeGreaterThan(commonScore);
		await assertNoSecretInBrowser(audienceOne, room.privateMarker);
		await completeGame(room, display);
	} finally {
		await closeRoom(room);
	}
});
