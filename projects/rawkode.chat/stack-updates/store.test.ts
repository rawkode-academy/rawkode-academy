import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { getValueAsDate, storeDate } from "./store.ts";

describe("storeDate", () => {
	it("stores dates as ISO strings", async () => {
		const keyValueStore = await Deno.openKv();

		const date = new Date("2023-10-01T00:00:00Z");
		await storeDate(keyValueStore, "key", date);

		const getValue = await keyValueStore.get(["key"]);

		keyValueStore.close();

		expect(getValue.value).toBe("2023-10-01T00:00:00.000Z");
	});
});

describe("getValueAsDate", () => {
	it("returns values as dates", async () => {
		const keyValueStore = await Deno.openKv();

		keyValueStore.set(["key"], "2023-10-01T00:00:00Z");

		const date = await getValueAsDate(keyValueStore, "key");

		keyValueStore.close();

		expect(date).toBeInstanceOf(Date);
	});

	it("can deserialize from existing value", async () => {
		const keyValueStore = await Deno.openKv();

		keyValueStore.set(["existingKey"], "2023-10-01T00:00:00Z");

		const date = await getValueAsDate(keyValueStore, "existingKey");
		expect(date.toISOString()).toBe("2023-10-01T00:00:00.000Z");

		keyValueStore.close();
	});

	it("can handle undefined values", async () => {
		const keyValueStore = await Deno.openKv();

		const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
		const date = await getValueAsDate(keyValueStore, "undefinedKey");

		keyValueStore.close();

		expect(date.getTime()).toBeGreaterThanOrEqual(sixHoursAgo.getTime());
		expect(date.getTime()).toBeLessThanOrEqual(sixHoursAgo.getTime() + 1000);
	});
});
