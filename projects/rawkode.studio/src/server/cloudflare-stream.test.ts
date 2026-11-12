import { describe, expect, it } from "vitest";
import {
	cloudflareStreamLiveInputIsConnected,
	type CloudflareStreamLiveInput,
} from "./cloudflare-stream";

describe("Cloudflare Stream live input status", () => {
	const cases: Array<{
		connected: boolean;
		name: string;
		status: CloudflareStreamLiveInput["status"];
	}> = [
		{ name: "documented connected string", status: "connected", connected: true },
		{ name: "documented reconnected string", status: "reconnected", connected: true },
		{ name: "reconnecting string", status: "reconnecting", connected: false },
		{
			name: "observed WebRTC current connection",
			status: { current: { ingestProtocol: "webrtc", state: "connected" }, history: [] },
			connected: true,
		},
		{ name: "current reconnection", status: { current: { state: "reconnected" } }, connected: true },
		{
			name: "disconnected current state despite connected history",
			status: { current: { state: "client_disconnect" }, history: [{ state: "connected" }] },
			connected: false,
		},
		{ name: "missing current state", status: { current: null, history: [{ state: "connected" }] }, connected: false },
		{ name: "missing status", status: null, connected: false },
	];

	it.each(cases)("uses the current state for $name", ({ status, connected }) => {
		expect(cloudflareStreamLiveInputIsConnected({ status })).toBe(connected);
	});
});
