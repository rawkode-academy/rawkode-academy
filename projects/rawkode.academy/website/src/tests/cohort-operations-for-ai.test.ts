import { readFileSync } from "node:fs";
import { z } from "astro/zod";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transpile = (filename: string) =>
	ts.transpileModule(readFileSync(filename, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;

const loadModule = (
	filename: string,
	imports: Record<string, unknown> = {},
): Record<string, unknown> => {
	const module = { exports: {} as Record<string, unknown> };
	new Function("require", "module", "exports", transpile(filename))(
		(id: string) => {
			if (!(id in imports))
				throw new Error(`Unexpected import ${id} in ${filename}`);
			return imports[id];
		},
		module,
		module.exports,
	);
	return module.exports;
};

type Cohort = typeof import("@/lib/cohorts/operations-for-ai");
type Stripe = typeof import("@/lib/stripe");

const cohort = loadModule(
	"src/lib/cohorts/operations-for-ai.ts",
) as unknown as Cohort;
const stripe = loadModule("src/lib/stripe.ts") as unknown as Stripe;

describe("Operations for AI cohort config", () => {
	it("has one Tuesday session per curriculum week, starting 12 January 2027", () => {
		expect(cohort.curriculum).toHaveLength(cohort.schedule.weeks);
		expect(cohort.sessionDates).toHaveLength(cohort.schedule.weeks);
		expect(cohort.sessionDates[0]).toBe(cohort.schedule.startDate);
		expect(cohort.schedule.startDate).toBe("2027-01-12");
		for (const date of cohort.sessionDates) {
			expect(new Date(`${date}T00:00:00Z`).getUTCDay()).toBe(2);
		}
		const gaps = cohort.sessionDates
			.slice(1)
			.map(
				(date, index) =>
					(Date.parse(date) - Date.parse(cohort.sessionDates[index]!)) /
					86_400_000,
			);
		expect(new Set(gaps)).toEqual(new Set([7]));
	});

	it("labels the confirmed start date", () => {
		expect(cohort.startsLabel()).toBe("Starts 12 January 2027");
		expect(cohort.scheduleConfirmed()).toBe(true);
		expect(cohort.startsLabel({ ...cohort.schedule, startDate: null })).toBe(
			"Starts January 2027",
		);
	});

	it("clamps seats to the per-order cap", () => {
		expect(cohort.clampSeats("3")).toBe(3);
		expect(cohort.clampSeats("0")).toBe(1);
		expect(cohort.clampSeats("lots")).toBe(1);
		expect(cohort.clampSeats(null)).toBe(1);
		expect(cohort.clampSeats("99")).toBe(cohort.offer.maxSeatsPerOrder);
	});

	it("prices the approval email from the offer", () => {
		expect(cohort.approvalEmail.body).toContain("$1,500 per seat");
		expect(cohort.approvalMailto.startsWith("mailto:?subject=")).toBe(true);
	});
});

describe("Stripe checkout params", () => {
	const input = {
		intakeId: "operations-for-ai-2027-01",
		productName: "Operations for AI: live cohort",
		productDescription: "Starts 12 January 2027.",
		unitAmountUsd: 1500,
		seats: 2,
		maxSeatsPerOrder: 5,
		successUrl:
			"https://rawkode.academy/courses/operations-for-ai/enrolled?session_id={CHECKOUT_SESSION_ID}",
		cancelUrl: "https://rawkode.academy/courses/operations-for-ai#enrol",
	};

	it("charges cents in USD and collects what an employer invoice needs", () => {
		const params = stripe.checkoutSessionParams(input);
		expect(params.get("mode")).toBe("payment");
		expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
		expect(params.get("line_items[0][price_data][unit_amount]")).toBe("150000");
		expect(params.get("line_items[0][quantity]")).toBe("2");
		expect(params.get("line_items[0][adjustable_quantity][maximum]")).toBe("5");
		expect(params.get("invoice_creation[enabled]")).toBe("true");
		expect(params.get("tax_id_collection[enabled]")).toBe("true");
		expect(params.get("billing_address_collection")).toBe("required");
		expect(params.get("metadata[intake]")).toBe(input.intakeId);
		expect(params.get("success_url")).toContain("{CHECKOUT_SESSION_ID}");
		expect(params.has("customer_email")).toBe(false);
	});

	it("prefills the signed-in user's email", () => {
		const params = stripe.checkoutSessionParams({
			...input,
			customerEmail: "ada@example.com",
			clientReferenceId: "user-1",
		});
		expect(params.get("customer_email")).toBe("ada@example.com");
		expect(params.get("client_reference_id")).toBe("user-1");
	});

	it("only accepts checkout session ids", () => {
		expect(stripe.isCheckoutSessionId("cs_test_a1B2c3D4e5F6g7")).toBe(true);
		expect(stripe.isCheckoutSessionId("cs_live_a1B2c3D4e5F6g7")).toBe(true);
		expect(stripe.isCheckoutSessionId("pi_123")).toBe(false);
		expect(stripe.isCheckoutSessionId("cs_test_../../v1/charges")).toBe(false);
		expect(stripe.isCheckoutSessionId(null)).toBe(false);
	});
});

describe("Stripe client", () => {
	beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
	afterEach(() => vi.unstubAllGlobals());

	it("returns the hosted checkout URL", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					id: "cs_test_1",
					url: "https://checkout.stripe.com/c/pay/cs_test_1",
					status: "open",
					payment_status: "unpaid",
				}),
			),
		);
		const session = await stripe.createCheckoutSession("sk_test_x", {
			intakeId: "i",
			productName: "p",
			productDescription: "d",
			unitAmountUsd: 1500,
			seats: 1,
			maxSeatsPerOrder: 5,
			successUrl: "https://example.com/s",
			cancelUrl: "https://example.com/c",
		});
		expect(session.url).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
		const [url, init] = vi.mocked(fetch).mock.calls[0]!;
		expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
		expect((init as RequestInit).headers).toMatchObject({
			Authorization: "Bearer sk_test_x",
		});
	});

	it("surfaces Stripe's error message", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: { message: "Invalid API Key", code: "api_key_invalid" },
				}),
				{ status: 401 },
			),
		);
		await expect(
			stripe.getCheckoutSession("sk_test_x", "cs_test_1234567890"),
		).rejects.toMatchObject({ message: "Invalid API Key", status: 401 });
	});

	it("reads payment status, email and quantity from a session", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					id: "cs_test_1234567890",
					payment_status: "paid",
					status: "complete",
					customer_details: { email: "ada@example.com" },
					line_items: { data: [{ quantity: 3 }] },
				}),
			),
		);
		const session = await stripe.getCheckoutSession(
			"sk_test_x",
			"cs_test_1234567890",
		);
		expect(session).toMatchObject({
			paymentStatus: "paid",
			customerEmail: "ada@example.com",
			quantity: 3,
		});
	});
});

describe("cohort invoice request action", () => {
	const limit = vi.fn();
	let attioApiKey: string | undefined;
	const captured: unknown[] = [];
	const actionModule = loadModule("src/actions/cohort.ts", {
		"astro:actions": { defineAction: (definition: unknown) => definition },
		"astro:env/server": {
			getSecret: (name: string) =>
				name === "ATTIO_API_KEY" ? attioApiKey : undefined,
		},
		"cloudflare:workers": {
			env: { PARTNERSHIP_FORM_RATE_LIMITER: { limit }, ANALYTICS: undefined },
		},
		"astro/zod": { z },
		"@/lib/cohorts/operations-for-ai": cohort,
		"@/lib/analytics/growth": {
			GROWTH_EVENTS: { COHORT_INVOICE_REQUESTED: "cohort_invoice_requested" },
		},
		"@/server/attio": loadModule("src/server/attio.ts"),
		"@/server/analytics": {
			captureServerEvent: async (event: unknown) => {
				captured.push(event);
			},
			getDistinctId: () => "anon",
			getEventAttribution: () => ({}),
		},
	}) as {
		cohort: {
			requestInvoice: {
				input: { parse: (value: unknown) => Record<string, unknown> };
				handler: (
					input: Record<string, unknown>,
					context: unknown,
				) => Promise<Record<string, unknown>>;
			};
		};
		invoiceRequestNote: (input: Record<string, unknown>) => string;
	};
	const action = actionModule.cohort.requestInvoice;
	const context = {
		request: new Request(
			"https://rawkode.academy/_actions/cohort.requestInvoice",
			{
				headers: { "CF-Connecting-IP": "192.0.2.10" },
			},
		),
		locals: {},
	};
	const form = {
		name: "Ada Lovelace",
		email: "ada@analytical.engine",
		company: "Analytical Engine",
		option: "public",
		seats: "3",
	};
	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status });
	const record = (id: string) => json({ data: { id: { record_id: id } } });

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
		limit.mockReset().mockResolvedValue({ success: true });
		attioApiKey = "attio-key";
		captured.length = 0;
	});
	afterEach(() => vi.unstubAllGlobals());

	it("coerces seats and rejects more than one cohort", () => {
		expect(action.input.parse(form).seats).toBe(3);
		expect(() => action.input.parse({ ...form, seats: "21" })).toThrow();
	});

	it("creates a valued deal for public seats", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(json({ data: [] }))
			.mockResolvedValueOnce(record("company-id"))
			.mockResolvedValueOnce(json({ data: [] }))
			.mockResolvedValueOnce(record("person-id"))
			.mockResolvedValueOnce(json({}))
			.mockResolvedValueOnce(record("deal-id"));

		const result = await action.handler(action.input.parse(form), context);

		expect(result).toEqual({ success: true, accepted: true });
		const dealCall = vi.mocked(fetch).mock.calls[5]!;
		expect(dealCall[0]).toBe("https://api.attio.com/v2/objects/deals/records");
		const deal = JSON.parse((dealCall[1] as RequestInit).body as string).data
			.values;
		expect(deal).toMatchObject({
			name: "Analytical Engine: Operations for AI × 3",
			value: 4500,
			owner: "david@rawkode.academy",
		});
		expect(captured).toHaveLength(1);
	});

	it("leaves private cohort enquiries unvalued", () => {
		const note = actionModule.invoiceRequestNote(
			action.input.parse({ ...form, option: "private", seats: "12" }),
		);
		expect(note).toContain("Private cohort enquiry for 12 engineers.");
		expect(note).toContain("Value: to be quoted.");
	});

	it("falls back to email when Attio isn't configured", async () => {
		attioApiKey = undefined;
		const result = await action.handler(action.input.parse(form), context);
		expect(result).toEqual({ success: false, fallback: "mailto" });
		expect(fetch).not.toHaveBeenCalled();
	});

	it("silently accepts honeypot submissions", async () => {
		const result = await action.handler(
			action.input.parse({ ...form, website: "spam.example" }),
			context,
		);
		expect(result).toEqual({ success: true, accepted: false });
		expect(fetch).not.toHaveBeenCalled();
	});
});
