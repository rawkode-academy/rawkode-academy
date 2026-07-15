import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser media runtime dependencies", () => {
	it("bundles exact RealtimeKit versions without mutable CDN imports", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as { dependencies?: Record<string, string> };
		const roomSource = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);

		expect(packageJson.dependencies).toMatchObject({
			"@cloudflare/realtimekit": "2.0.0",
			"@cloudflare/realtimekit-ui": "2.0.0",
		});
		expect(roomSource).toContain('import("@cloudflare/realtimekit")');
		expect(roomSource).toContain(
			'import("@cloudflare/realtimekit-ui/loader")',
		);
		expect(roomSource).not.toContain("cdn.jsdelivr.net");
		expect(roomSource).not.toContain("@latest");
	});

	it("lets the advertised RealtimeKit setup screen own room join", () => {
		const roomSource = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);

		expect(roomSource).toContain('show-setup-screen="true"');
		expect(roomSource).toContain("observeRealtimeKitRoomLifecycle");
		expect(roomSource).not.toContain("join.call(nextMeeting)");
		expect(roomSource).not.toContain("nextMeeting.joinRoom ?? nextMeeting.join");
	});
});
