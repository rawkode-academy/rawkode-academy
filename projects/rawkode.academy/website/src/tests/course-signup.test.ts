import { readFileSync } from "node:fs";
import {
	beforeAll,
	beforeEach,
	afterEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { z } from "astro/zod";
import ts from "typescript";

// Evaluate actual modules; isolate only Astro/provider/session/analytics boundaries.
const contacts = { get: vi.fn(), create: vi.fn(), update: vi.fn() };
const session = { get: vi.fn(), set: vi.fn() };
const captureServerEvent = vi.fn();
const getSecret = vi.fn();
const notFound = { data: null, error: { name: "not_found", statusCode: 404 } };
const providerError = {
	data: null,
	error: { name: "application_error", statusCode: 500 },
};
class MockActionError extends Error {
	code: string;
	constructor({ code, message }: { code: string; message: string }) {
		super(message);
		this.code = code;
	}
}
const imports: Record<string, unknown> = {
	"node:process": { __esModule: true, default: { env: {} } },
	"astro:actions": {
		ActionError: MockActionError,
		defineAction: (definition: unknown) => definition,
	},
	"astro:env/server": { getSecret },
	"astro/zod": { z },
	"cloudflare:workers": { env: {} },
	resend: {
		Resend: class {
			contacts = contacts;
		},
	},
	"@/lib/analytics/attribution": { parseCampaignAttribution: () => ({}) },
	"@/lib/analytics/growth": {
		GROWTH_EVENTS: { COURSE_SIGNUP: "signup", ACTIVATED_USER: "activated" },
	},
	"../server/analytics": {
		captureServerEvent,
		getAttributionFromSource: () => ({}),
		getDistinctId: () => "fixture",
		getEventAttribution: () => ({}),
	},
};
function evaluate(file: string) {
	const code = ts.transpileModule(readFileSync(file, "utf8"), {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
		},
	}).outputText;
	const exports: Record<string, any> = {};
	new Function("require", "exports", code)((id: string) => {
		if (!(id in imports)) throw new Error(`Unexpected import ${id}`);
		return imports[id];
	}, exports);
	return exports;
}
let handler: (
	data: Record<string, unknown>,
	ctx: Record<string, unknown>,
) => Promise<{ success: boolean; message: string; sponsorStatus: string }>;
let isSubscribed: (
	audience: string,
	email?: string,
	session?: unknown,
) => Promise<boolean>;
beforeAll(() => {
	handler = evaluate("src/actions/courses.ts").signupForCourseUpdates.handler;
	isSubscribed = evaluate("src/server/subscriptions.ts").isSubscribedToAudience;
});
beforeEach(() => {
	contacts.get.mockReset().mockResolvedValue(notFound);
	contacts.create
		.mockReset()
		.mockResolvedValue({ data: { id: "created" }, error: null });
	contacts.update
		.mockReset()
		.mockResolvedValue({ data: { id: "updated" }, error: null });
	session.get.mockReset().mockResolvedValue({});
	session.set.mockReset().mockResolvedValue(undefined);
	getSecret.mockReset().mockReturnValue("fake-test-key");
	captureServerEvent.mockReset().mockResolvedValue(undefined);
});
afterEach(() => expect(fetch).not.toHaveBeenCalled());
const submit = (changes = {}, locals = {}) =>
	handler(
		{
			email: "reader@example.test",
			audienceId: "course",
			allowSponsorContact: false,
			...changes,
		},
		{ locals, session, request: new Request("https://example.test/") },
	);
const noSuccessWrites = () => {
	expect(session.set).not.toHaveBeenCalled();
	expect(captureServerEvent).not.toHaveBeenCalled();
};

describe("course subscription integrity", () => {
	it("records success only after a confirmed course write, without sponsor opt-in", async () => {
		expect((await submit({ sponsorAudienceId: "sponsor" })).success).toBe(true);
		expect(contacts.create).toHaveBeenCalledExactlyOnceWith({
			email: "reader@example.test",
			audienceId: "course",
			unsubscribed: false,
		});
		expect(session.set).toHaveBeenCalledWith("signedUpCourses", {
			course: "reader@example.test",
		});
		expect(captureServerEvent).toHaveBeenCalledTimes(2);
		expect(contacts.create.mock.invocationCallOrder[0]).toBeLessThan(
			session.set.mock.invocationCallOrder[0]!,
		);
	});
	it.each([
		providerError,
		{ data: null, error: null },
		{ data: {}, error: null },
	])("rejects unsuccessful course response %j", async (response) => {
		contacts.create.mockResolvedValue(response);
		await expect(
			submit({ allowSponsorContact: true, sponsorAudienceId: "sponsor" }),
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		expect(contacts.create).toHaveBeenCalledTimes(1);
		noSuccessWrites();
	});
	it("blocks on lookup errors rather than creating after an indeterminate check", async () => {
		contacts.get.mockResolvedValue(providerError);
		await expect(submit()).rejects.toBeInstanceOf(MockActionError);
		expect(contacts.create).not.toHaveBeenCalled();
		noSuccessWrites();
	});
	it("blocks on thrown provider failures", async () => {
		contacts.create.mockRejectedValue(new Error("network fixture"));
		await expect(submit()).rejects.toBeInstanceOf(MockActionError);
		noSuccessWrites();
	});
	it("resubscribes an opted-out course contact by updating it", async () => {
		contacts.get.mockResolvedValue({
			data: { id: "existing", unsubscribed: true },
			error: null,
		});
		expect((await submit()).success).toBe(true);
		expect(contacts.update).toHaveBeenCalledWith({
			id: "existing",
			audienceId: "course",
			unsubscribed: false,
		});
		expect(contacts.create).not.toHaveBeenCalled();
	});
	it("does not report success for a failed resubscription update", async () => {
		contacts.get.mockResolvedValue({
			data: { id: "existing", unsubscribed: true },
			error: null,
		});
		contacts.update.mockResolvedValue(providerError);
		await expect(submit()).rejects.toBeInstanceOf(MockActionError);
		noSuccessWrites();
	});
	it.each([
		"returned",
		"thrown",
		"missing-data",
	])("reports course success and unconfirmed sponsor after %s sponsor failure", async (mode) => {
		if (mode === "thrown")
			contacts.create
				.mockResolvedValueOnce({ data: { id: "course" }, error: null })
				.mockRejectedValueOnce(new Error("sponsor fixture"));
		else
			contacts.create
				.mockResolvedValueOnce({ data: { id: "course" }, error: null })
				.mockResolvedValueOnce(
					mode === "returned" ? providerError : { data: null, error: null },
				);
		await expect(
			submit({ allowSponsorContact: true, sponsorAudienceId: "sponsor" }),
		).resolves.toMatchObject({ success: true, sponsorStatus: "unconfirmed" });
		expect(session.set).toHaveBeenCalledWith("signedUpCourses", { course: "reader@example.test" });
		expect(captureServerEvent).toHaveBeenCalledTimes(2);
	});
	it("can retry an already-created course after sponsor failure", async () => {
		contacts.get
			.mockResolvedValueOnce({
				data: { id: "course", unsubscribed: false },
				error: null,
			})
			.mockResolvedValueOnce(notFound);
		expect(
			(
				await submit({
					allowSponsorContact: true,
					sponsorAudienceId: "sponsor",
				})
			).success,
		).toBe(true);
		expect(contacts.create).toHaveBeenCalledExactlyOnceWith({
			email: "reader@example.test",
			audienceId: "sponsor",
			unsubscribed: false,
		});
	});
	it("checks and restores an opted-out sponsor only with consent", async () => {
		contacts.get
			.mockResolvedValueOnce({
				data: { id: "course", unsubscribed: false },
				error: null,
			})
			.mockResolvedValueOnce({
				data: { id: "sponsor", unsubscribed: true },
				error: null,
			});
		await submit({ allowSponsorContact: true, sponsorAudienceId: "sponsor" });
		expect(contacts.update).toHaveBeenCalledExactlyOnceWith({
			id: "sponsor",
			audienceId: "sponsor",
			unsubscribed: false,
		});
	});
	it("uses the authenticated identity rather than the submitted email", async () => {
		await submit({}, { user: { email: "account@example.test" } });
		expect(contacts.get).toHaveBeenCalledWith({
			email: "account@example.test",
			audienceId: "course",
		});
	});
	it("retains course success after a failed sponsor opt-in update", async () => {
		contacts.get
			.mockResolvedValueOnce({
				data: { id: "course", unsubscribed: false },
				error: null,
			})
			.mockResolvedValueOnce({
				data: { id: "sponsor", unsubscribed: true },
				error: null,
			});
		contacts.update.mockResolvedValue(providerError);
		await expect(
			submit({ allowSponsorContact: true, sponsorAudienceId: "sponsor" }),
		).resolves.toMatchObject({ success: true, sponsorStatus: "unconfirmed" });
		expect(session.set).toHaveBeenCalled();
	});
	it("reports an unconfirmed sponsor lookup without duplicate course writes", async () => {
		contacts.get
			.mockResolvedValueOnce({
				data: { id: "course", unsubscribed: false },
				error: null,
			})
			.mockResolvedValueOnce(providerError);
		await expect(
			submit({ allowSponsorContact: true, sponsorAudienceId: "sponsor" }),
		).resolves.toMatchObject({ success: true, sponsorStatus: "unconfirmed" });
		expect(contacts.create).not.toHaveBeenCalled();
		expect(session.set).toHaveBeenCalled();
	});
	it("rejects missing email or provider configuration before external writes", async () => {
		await expect(submit({ email: undefined })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		getSecret.mockReturnValue(undefined);
		await expect(submit()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
		expect(contacts.create).not.toHaveBeenCalled();
		noSuccessWrites();
	});
});

describe("current subscription checks", () => {
	it.each([
		false,
		true,
	])("honors provider unsubscribed=%s", async (unsubscribed) => {
		contacts.get.mockResolvedValue({
			data: { id: "contact", unsubscribed },
			error: null,
		});
		expect(await isSubscribed("course", "reader@example.test")).toBe(
			!unsubscribed,
		);
	});
	it("does not trust an anonymous session flag after an unsubscribe", async () => {
		session.get.mockResolvedValue({ course: "previous@example.test" });
		contacts.get.mockResolvedValue({
			data: { id: "contact", unsubscribed: true },
			error: null,
		});
		expect(await isSubscribed("course", undefined, session)).toBe(false);
		expect(contacts.get).toHaveBeenCalledWith({
			email: "previous@example.test",
			audienceId: "course",
		});
		expect(session.set).not.toHaveBeenCalled();
	});
	it.each([
		providerError,
		notFound,
		{ data: { id: "contact" }, error: null },
	])("never treats indeterminate provider state as subscribed: %j", async (response) => {
		contacts.get.mockResolvedValue(response);
		expect(await isSubscribed("course", "reader@example.test")).toBe(false);
	});
	it("does not query a provider without an identity", async () => {
		expect(await isSubscribed("course", undefined, session)).toBe(false);
		expect(contacts.get).not.toHaveBeenCalled();
	});
});
