import { describe, expect, it } from "vitest";
import {
	formatLocal,
	isCalendarDate,
	LOCAL_TIME_ATTRIBUTE,
	localTime,
} from "@/lib/local-time";

const swampClub = new Date("2026-10-22T16:00:00.000Z");
const scheduleOptions: Intl.DateTimeFormatOptions = {
	weekday: "short",
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
};

describe("localTime", () => {
	it("renders a UTC fallback and carries the instant plus format", () => {
		const value = localTime(swampClub, scheduleOptions);
		expect(value.text).toBe("Thu, Oct 22, 4:00 PM UTC");
		expect(value.attrs.datetime).toBe("2026-10-22T16:00:00.000Z");
		expect(JSON.parse(value.attrs[LOCAL_TIME_ATTRIBUTE])).toEqual({
			locale: "en-US",
			options: scheduleOptions,
		});
	});

	it("ignores a caller-supplied time zone in the spec", () => {
		const value = localTime(swampClub, { ...scheduleOptions, timeZone: "UTC" });
		expect(
			JSON.parse(value.attrs[LOCAL_TIME_ATTRIBUTE]).options,
		).not.toHaveProperty("timeZone");
	});
});

describe("formatLocal", () => {
	it("moves timed instants into the reader's zone", () => {
		expect(
			formatLocal(swampClub, scheduleOptions, "en-GB", "Europe/London"),
		).toBe("Thu 22 Oct, 17:00 BST");
		expect(
			formatLocal(swampClub, scheduleOptions, "en-US", "America/Los_Angeles"),
		).toBe("Thu, Oct 22, 9:00 AM PDT");
	});

	it("keeps calendar dates on their UTC day for readers west of Greenwich", () => {
		const calendarDay = new Date("2026-10-01T00:00:00.000Z");
		expect(isCalendarDate(calendarDay)).toBe(true);
		expect(
			formatLocal(
				calendarDay,
				{ year: "numeric", month: "short", day: "numeric" },
				"en-US",
				"America/New_York",
			),
		).toBe("Oct 1, 2026");
	});

	it("does not treat timed instants as calendar dates", () => {
		expect(isCalendarDate(swampClub)).toBe(false);
	});
});
