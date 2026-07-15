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

	it("keeps the operator room in an accessible, bounded dock after setup", () => {
		const roomSource = readFileSync(
			new URL("../components/RealtimeKitRoom.vue", import.meta.url),
			"utf8",
		);
		const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

		expect(roomSource).toContain("const operatorDockOpen = ref(true)");
		expect(roomSource).toContain("minimizeOperatorDock(true)");
		expect(roomSource).toContain('v-show="roomUiIsVisible"');
		expect(roomSource).toContain(':aria-controls="roomControlsId"');
		expect(roomSource).toContain(':aria-expanded="operatorDockOpen"');
		expect(roomSource).toContain("roomControlsToggle.value?.focus()");
		expect(roomSource).toContain('state.value !== "connected" || !operatorDockOpen.value');
		expect(roomSource).toContain('@keydown.esc="handleOperatorDockEscape"');
		expect(roomSource).not.toContain("@keydown.esc.stop");
		expect(roomSource).toContain('mode="fill"');
		expect(styles).toContain("width: min(420px, calc(100vw - 32px))");
		expect(styles).toContain("height: min(360px, calc(100dvh - 88px))");
		expect(styles).toContain('.realtimekit-room[data-layout="dock"][data-state="setup"]');
		expect(styles).toContain("height: min(520px, 68dvh)");
	});
});
