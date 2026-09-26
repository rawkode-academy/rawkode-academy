import { expect, test } from "@playwright/test";
import { closeRoom, createSeededRoom, openContestant, openDisplay } from "./support/arcade";

test("a live host creates production contestant and display invitations", async ({
	browser,
	page,
	request,
}) => {
	const room = await createSeededRoom(page, request, "merge-conflict");
	try {
		await room.host.getByTestId("mint-player-invite").click();
		const playerCode = (await room.host.getByTestId("player-invite-code").innerText()).trim();
		expect(playerCode).toBeTruthy();

		await room.host.getByTestId("mint-display-invite").click();
		const displayCode = (await room.host.getByTestId("display-invite-code").innerText()).trim();
		expect(displayCode).toBeTruthy();
		expect(displayCode).not.toBe(playerCode);

		room.codes.player = playerCode;
		room.codes.display = displayCode;
		const contestant = await openContestant(browser, room, {
			name: "Production Invite Player",
			teamId: "team-red",
		});
		const display = await openDisplay(browser, room);
		await expect(contestant.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
		await expect(display.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
	} finally {
		await closeRoom(room);
	}
});
