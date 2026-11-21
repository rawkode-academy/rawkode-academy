import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	mock,
	spyOn,
} from "bun:test";
mock.module("cloudflare:workers", () => ({
	WorkerEntrypoint: class {},
	DurableObject: class {},
}));
const { PostHogCollector } = await import("../src/index");
const event = {
	specversion: "1.0",
	source: "website",
	id: "event-one",
	type: "test",
	time: "2026-11-14T00:00:00Z",
	data: { private: "sensitive-data" },
};
let addEvent: ReturnType<typeof mock>;
let collector: InstanceType<typeof PostHogCollector>;
function track(body: unknown) {
	return collector.fetch(
		new Request("https://analytics.internal/track", {
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}
beforeEach(() => {
	addEvent = mock().mockResolvedValue(undefined);
	collector = Object.create(PostHogCollector.prototype) as InstanceType<
		typeof PostHogCollector
	>;
	Object.defineProperty(collector, "env", {
		value: {
			DATA_BUFFER: {
				idFromName: (name: string) => name,
				get: () => ({ addEvent }),
			},
		},
	});
	spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => mock.restore());
describe("collector acceptance receipts", () => {
	test("only acknowledges matching identity after durable acceptance completes", async () => {
		let accept!: () => void;
		addEvent.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					accept = resolve;
				}),
		);
		let acknowledged = false;
		const pending = track({ event }).then((response) => {
			acknowledged = true;
			return response;
		});
		for (let i = 0; i < 100 && !accept; i++)
			await new Promise((resolve) => setTimeout(resolve, 1));
		expect(accept).toBeTypeOf("function");
		expect(acknowledged).toBe(false);
		accept();
		const response = await pending;
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			receipt: {
				version: 1,
				event_source: "website",
				event_id: "event-one",
				disposition: "persisted",
			},
		});
	});
	test("returns retryable 503 without leaking storage errors or event contents", async () => {
		addEvent.mockRejectedValueOnce(new Error("private-storage-token"));
		const response = await track({ event });
		expect(response.status).toBe(503);
		const output =
			JSON.stringify(await response.json()) +
			JSON.stringify((console.error as ReturnType<typeof mock>).mock.calls);
		expect(output).not.toContain("private-storage-token");
		expect(output).not.toContain("sensitive-data");
	});
	test("keeps malformed, invalid and forged browser events non-retryable", async () => {
		expect((await track("{")).status).toBe(400);
		expect((await track({ event: {} })).status).toBe(400);
		expect(
			(await track({ event: { ...event, source: "rawkode-academy-browser" } }))
				.status,
		).toBe(403);
		expect(addEvent).not.toHaveBeenCalled();
	});
	test("labels bot filtering instead of claiming persistence", async () => {
		const response = await track({
			event: { ...event, useragent: "Googlebot/2.1" },
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			success: true,
			receipt: { disposition: "filtered" },
		});
		expect(addEvent).not.toHaveBeenCalled();
	});
});
