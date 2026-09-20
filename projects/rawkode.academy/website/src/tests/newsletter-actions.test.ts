import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "astro/zod";
import ts from "typescript";

// Execute the actual action module; mock only Astro registration, provider and analytics.
const setPreference = vi.fn();
const captureServerEvent = vi.fn();
const setCookie = vi.fn();
const imports: Record<string, unknown> = {
	"astro:actions": { defineAction: (definition: unknown) => definition },
	"astro/zod": { z },
	"cloudflare:workers": {
		env: { EMAIL_PREFERENCES: { setPreference }, ANALYTICS: {} },
	},
	"@/lib/analytics/attribution": { parseCampaignAttribution: () => ({}) },
	"@/lib/analytics/growth": {
		GROWTH_EVENTS: {
			NEWSLETTER_SUBSCRIBED: "subscribed",
			ACTIVATED_USER: "activated",
			LEAD_MAGNET_SIGNUP: "lead-magnet-signup",
		},
	},
	"@/server/analytics": {
		captureServerEvent,
		getAttributionFromSource: () => ({ source_surface: "lead-magnet" }),
		getDistinctId: () => "fixture",
		getEventAttribution: () => ({}),
	},
};
const code = ts.transpileModule(
	readFileSync("src/actions/newsletter.ts", "utf8"),
	{
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	},
).outputText;
type Action = {
	handler: (
		input: Record<string, unknown>,
		context: Record<string, unknown>,
	) => Promise<unknown>;
};
const exports: { newsletter?: Record<string, Action> } = {};
new Function("require", "exports", code)((id: string) => {
	if (!(id in imports)) throw new Error(`Unexpected import ${id}`);
	return imports[id];
}, exports);
const newsletter = exports.newsletter!;
const input = {
	audience: "technology:acorn",
	channel: "newsletter",
	source: "website:newsletter:/technology/acorn",
	email: " Reader@Example.Test ",
};
const context = (signedIn: boolean) => ({
	locals: signedIn ? { user: { id: "learner-fixture" } } : {},
	cookies: { set: setCookie },
	request: new Request("https://example.test/technology/acorn"),
});
const noSuccessEffects = () => {
	expect(captureServerEvent).not.toHaveBeenCalled();
	expect(setCookie).not.toHaveBeenCalled();
};

beforeEach(() => {
	setPreference.mockReset();
	setCookie.mockReset();
	captureServerEvent.mockReset().mockResolvedValue(undefined);
});
afterEach(() => expect(fetch).not.toHaveBeenCalled());

for (const name of ["subscribe", "subscribeWithEmail"] as const) {
	describe(`${name} confirmed preference contract`, () => {
		const signedIn = name === "subscribe";
		const submit = () => newsletter[name]!.handler(input, context(signedIn));

		it.each([
			{ success: false, alreadySubscribed: false },
			{ alreadySubscribed: true },
			null,
			undefined,
		])("rejects unconfirmed provider result %j without success analytics/cookie", async (result) => {
			setPreference.mockResolvedValue(result);
			await expect(submit()).rejects.toThrow("Subscription was not confirmed");
			expect(setPreference).toHaveBeenCalledTimes(1);
			noSuccessEffects();
		});

		it("preserves thrown provider failure without success effects", async () => {
			setPreference.mockRejectedValue(
				new Error("provider unavailable fixture"),
			);
			await expect(submit()).rejects.toThrow("provider unavailable fixture");
			noSuccessEffects();
		});

		it.each([
			false,
			true,
		])("returns a confirmed provider result unchanged (alreadySubscribed=%s)", async (alreadySubscribed) => {
			const result = {
				success: true,
				alreadySubscribed,
				preference: { audience: input.audience },
			};
			setPreference.mockResolvedValue(result);
			expect(await submit()).toBe(result);
			expect(setPreference).toHaveBeenCalledExactlyOnceWith(
				signedIn ? "learner:learner-fixture" : "email:reader@example.test",
				{
					audience: input.audience,
					channel: input.channel,
					status: "subscribed",
					source: input.source,
				},
			);
			expect(captureServerEvent).toHaveBeenCalledTimes(
				alreadySubscribed ? 1 : 2,
			);
			expect(setPreference.mock.invocationCallOrder[0]).toBeLessThan(
				captureServerEvent.mock.invocationCallOrder[0]!,
			);
			if (signedIn) expect(setCookie).not.toHaveBeenCalled();
			else {
				expect(setCookie).toHaveBeenCalledExactlyOnceWith(
					"newsletter:technology:acorn:updates",
					"true",
					{
						path: "/",
						maxAge: 60 * 60 * 24 * 365,
						httpOnly: false,
						secure: true,
						sameSite: "lax",
					},
				);
			}
		});

		it("does not emit success while provider confirmation is pending", async () => {
			let complete!: (value: unknown) => void;
			setPreference.mockReturnValue(
				new Promise((resolve) => {
					complete = resolve;
				}),
			);
			const pending = submit();
			noSuccessEffects();
			complete({ success: false });
			await expect(pending).rejects.toThrow("Subscription was not confirmed");
			noSuccessEffects();
		});
	});
}

it("keeps the signed-in subscribe authentication boundary unchanged", async () => {
	await expect(
		newsletter.subscribe!.handler(input, context(false)),
	).rejects.toThrow("Unauthorized");
	expect(setPreference).not.toHaveBeenCalled();
	noSuccessEffects();
});
