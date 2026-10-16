import { readFileSync } from "node:fs";
import { z } from "astro/zod";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
let attioApiKey: string | undefined;
const workerEnv = {
	PARTNERSHIP_FORM_RATE_LIMITER: { limit },
	ATTIO_INBOUND_DEAL_STAGE: undefined as string | undefined,
	ATTIO_INBOUND_DEAL_OFFER_ATTRIBUTE: undefined as string | undefined,
	ATTIO_SOURCE_ATTRIBUTE: undefined as string | undefined,
	ATTIO_SOURCE_VALUE: undefined as string | undefined,
};
const loadModule = (filename: string) => {
	const output = ts.transpileModule(readFileSync(filename, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const module = { exports: {} as Record<string, unknown> };
	new Function("require", "module", "exports", output)(
		() => {
			throw new Error(`Unexpected import from ${filename}`);
		},
		module,
		module.exports,
	);
	return module.exports;
};
const partnerships = loadModule("src/lib/partnerships.ts") as {
	applicationPaths: readonly [
		"Product review",
		"90-day partnership",
		"Annual plan",
		"Not sure yet",
	];
	applicationPathLabels: Record<string, string>;
	applicationPathDeals: Record<string, { offer: string; valueUsd: number }>;
	resolveApplicationPath: (
		value: string | null | undefined,
	) => string | undefined;
};
const imports: Record<string, unknown> = {
	"astro:actions": { defineAction: (definition: unknown) => definition },
	"astro:env/server": {
		getSecret: (name: string) =>
			name === "ATTIO_API_KEY" ? attioApiKey : undefined,
	},
	"astro/zod": { z },
	"cloudflare:workers": { env: workerEnv },
	"@/lib/partnerships": partnerships,
};
const code = ts.transpileModule(
	readFileSync("src/actions/partnership.ts", "utf8"),
	{
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	},
).outputText;
type Action = {
	input: {
		parse: (value: unknown) => Record<string, unknown>;
	};
	handler: (
		input: Record<string, unknown>,
		context: { request: Request },
	) => Promise<Record<string, unknown>>;
};
const exports: { partnership?: { apply: Action } } = {};
new Function("require", "exports", code)((id: string) => {
	if (!(id in imports)) throw new Error(`Unexpected import ${id}`);
	return imports[id];
}, exports);
const apply = exports.partnership!.apply;

const input = {
	name: "Ada Lovelace",
	email: "ada@analytical.engine",
	company: "Analytical Engine",
	path: "Product review",
	message: "Please review our Kubernetes quick start.",
	website: "",
};
const context = {
	request: new Request("https://rawkode.academy/_actions/partnership.apply", {
		headers: { "CF-Connecting-IP": "192.0.2.10" },
	}),
};
const recordResponse = (recordId: string) =>
	new Response(JSON.stringify({ data: { id: { record_id: recordId } } }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
const requestBody = (call: readonly unknown[]) =>
	JSON.parse((call[1] as RequestInit).body as string);
const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
const emptyQuery = () => jsonResponse({ data: [] });
const matchedQuery = (recordId: string) =>
	jsonResponse({ data: [{ id: { record_id: recordId } }] });
const ok = (status = 200) => new Response(null, { status });
const mockCreatedPath = ({
	attribute = ok(),
	note = ok(),
	deal = recordResponse("deal-id"),
}: {
	attribute?: Response;
	note?: Response;
	deal?: Response;
} = {}) => {
	vi.mocked(fetch)
		.mockResolvedValueOnce(emptyQuery())
		.mockResolvedValueOnce(recordResponse("company-id"))
		.mockResolvedValueOnce(emptyQuery())
		.mockResolvedValueOnce(recordResponse("person-id"))
		.mockResolvedValueOnce(attribute)
		.mockResolvedValueOnce(note)
		.mockResolvedValueOnce(deal);
};
const callUrl = (call: readonly unknown[]) => String(call[0]);
const callMethod = (call: readonly unknown[]) =>
	(call[1] as RequestInit | undefined)?.method ?? "GET";
const COMPANY_RECORDS = "https://api.attio.com/v2/objects/companies/records";
const PERSON_RECORDS = "https://api.attio.com/v2/objects/people/records";
const NOTES = "https://api.attio.com/v2/notes";
const noteCalls = () =>
	vi.mocked(fetch).mock.calls.filter((call) => callUrl(call) === NOTES);
const expectNoUpsert = () => {
	for (const call of vi.mocked(fetch).mock.calls) {
		expect(callUrl(call)).not.toContain("matching_attribute");
		expect(callMethod(call)).not.toBe("PUT");
	}
};
const providerRejection = (code: string, message: string, status: number) =>
	jsonResponse({ code, message }, status);
const expectSanitizedFallback = (
	result: Record<string, unknown>,
	code: string,
	logged: { mock: { calls: unknown[][] } },
	secrets: readonly string[],
	loggedMarkers: readonly string[] = [],
) => {
	expect(result).toEqual({ success: false, fallback: "mailto", code });
	const loggedText = JSON.stringify(logged.mock.calls);
	expect(loggedText).toContain(code);
	for (const marker of loggedMarkers) {
		expect(loggedText).toContain(marker);
	}
	const visible = `${JSON.stringify(result)}\n${loggedText}`;
	for (const secret of secrets) {
		expect(visible).not.toContain(secret);
	}
};

beforeEach(() => {
	attioApiKey = "attio-test-key";
	workerEnv.ATTIO_INBOUND_DEAL_STAGE = undefined;
	workerEnv.ATTIO_INBOUND_DEAL_OFFER_ATTRIBUTE = undefined;
	workerEnv.ATTIO_SOURCE_ATTRIBUTE = undefined;
	workerEnv.ATTIO_SOURCE_VALUE = undefined;
	limit.mockReset().mockResolvedValue({ success: true });
	vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("partnership Attio action", () => {
	it("accepts honeypot submissions without touching Attio or PostHog", async () => {
		await expect(
			apply.handler({ ...input, website: "https://spam.test" }, context),
		).resolves.toEqual({ success: true, accepted: false });
		expect(limit).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns a mailto fallback when ATTIO_API_KEY is missing", async () => {
		attioApiKey = undefined;
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: false,
			fallback: "mailto",
			code: "crm_unconfigured",
		});
		expect(limit).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rate limits before writing CRM records", async () => {
		limit.mockResolvedValue({ success: false });

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: false,
			rateLimited: true,
		});
		expect(limit).toHaveBeenCalledOnce();
		const key = limit.mock.calls[0]![0].key;
		expect(key).toMatch(/^[a-f0-9]{64}$/);
		expect(key).not.toContain(input.email);
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([
		["Product review", 5000, "Review"],
		["Not sure yet", 5000, "Review"],
		["90-day partnership", 12000, "Partnership (Quarterly)"],
		["Annual plan", 40000, "Partnership (Yearly)"],
	] as const)("creates a company and person, then a note and a %s deal worth $%i offered as %s", async (path, value, offer) => {
		mockCreatedPath();

		await expect(apply.handler({ ...input, path }, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});
		expect(fetch).toHaveBeenCalledTimes(7);

		const calls = vi.mocked(fetch).mock.calls;
		const companyQuery = calls[0]!;
		const company = calls[1]!;
		const personQuery = calls[2]!;
		const person = calls[3]!;
		const attribute = calls[4]!;
		const note = calls[5]!;
		const deal = calls[6]!;
		expect(callUrl(companyQuery)).toBe(`${COMPANY_RECORDS}/query`);
		expect(callMethod(companyQuery)).toBe("POST");
		expect(requestBody(companyQuery)).toEqual({
			filter: {
				domains: { domain: { $eq: "analytical.engine" } },
			},
			limit: 1,
		});
		expect(callUrl(company)).toBe(COMPANY_RECORDS);
		expect(callMethod(company)).toBe("POST");
		expect(requestBody(company)).toEqual({
			data: {
				values: {
					name: input.company,
					domains: ["analytical.engine"],
				},
			},
		});
		expect(callUrl(personQuery)).toBe(`${PERSON_RECORDS}/query`);
		expect(requestBody(personQuery)).toEqual({
			filter: {
				email_addresses: {
					email_address: { $eq: input.email },
				},
			},
			limit: 1,
		});
		expect(callUrl(person)).toBe(PERSON_RECORDS);
		expect(callMethod(person)).toBe("POST");
		expect(requestBody(person).data.values).toEqual({
			name: [{ full_name: input.name }],
			email_addresses: [input.email],
			company: [
				{
					target_object: "companies",
					target_record_id: "company-id",
				},
			],
		});
		expect(callUrl(attribute)).toBe(
			"https://api.attio.com/v2/objects/deals/attributes/source",
		);
		expect(callUrl(note)).toBe(NOTES);
		expect(requestBody(note).data).toMatchObject({
			parent_object: "people",
			parent_record_id: "person-id",
			title: `Partnership enquiry: ${partnerships.applicationPathLabels[path]}`,
			content: input.message,
		});
		expect(noteCalls()).toHaveLength(1);
		expect(callUrl(deal)).toBe(
			"https://api.attio.com/v2/objects/deals/records",
		);
		expect(requestBody(deal).data.values).toMatchObject({
			stage: "In Progress",
			owner: "david@rawkode.academy",
			value,
			offer,
			source: "Inbound: partnerships page",
			associated_company: {
				target_object: "companies",
				target_record_id: "company-id",
			},
		});
		for (const call of calls) {
			expect((call[1] as RequestInit).headers).toMatchObject({
				Authorization: "Bearer attio-test-key",
			});
		}
		expectNoUpsert();
	});

	it("keeps the core Attio writes when deal creation fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mockCreatedPath({ deal: ok(500) });

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});
		expect(fetch).toHaveBeenCalledTimes(7);
	});

	it("uses the configured inbound deal stage", async () => {
		workerEnv.ATTIO_INBOUND_DEAL_STAGE = "Qualified";
		mockCreatedPath();

		await apply.handler(input, context);

		const deal = vi.mocked(fetch).mock.calls[6]!;
		expect(requestBody(deal).data.values.stage).toBe("Qualified");
	});

	it("renames the Offer attribute without changing the route's offer or value", async () => {
		workerEnv.ATTIO_INBOUND_DEAL_OFFER_ATTRIBUTE = "inbound_offer";
		mockCreatedPath();

		await apply.handler({ ...input, path: "Annual plan" }, context);

		const deal = vi.mocked(fetch).mock.calls[6]!;
		expect(requestBody(deal).data.values).toMatchObject({
			value: 40000,
			inbound_offer: "Partnership (Yearly)",
		});
		expect(requestBody(deal).data.values).not.toHaveProperty("offer");
	});

	it("does not let env overrides replace a route's offer or value", () => {
		const actionSource = readFileSync("src/actions/partnership.ts", "utf8");
		const astroConfig = readFileSync("astro.config.mts", "utf8");
		const wrangler = readFileSync("wrangler.jsonc", "utf8");
		for (const source of [actionSource, astroConfig, wrangler]) {
			expect(source).not.toContain("ATTIO_INBOUND_DEAL_VALUE_USD");
			expect(source).not.toContain("ATTIO_INBOUND_DEAL_OFFER_OPTION");
		}
	});

	it("maps legacy route names onto the current options and prices", () => {
		expect([...partnerships.applicationPaths]).toEqual([
			"Product review",
			"90-day partnership",
			"Annual plan",
			"Not sure yet",
		]);
		expect(partnerships.applicationPathDeals).toEqual({
			"Product review": { offer: "Review", valueUsd: 5000 },
			"Not sure yet": { offer: "Review", valueUsd: 5000 },
			"90-day partnership": {
				offer: "Partnership (Quarterly)",
				valueUsd: 12000,
			},
			"Annual plan": { offer: "Partnership (Yearly)", valueUsd: 40000 },
		});
		expect(partnerships.resolveApplicationPath("First-run review")).toBe(
			"Product review",
		);
		expect(partnerships.resolveApplicationPath("Fit & Proof Review")).toBe(
			"Product review",
		);
		expect(partnerships.resolveApplicationPath("Product review")).toBe(
			"Product review",
		);
		expect(partnerships.resolveApplicationPath("Annual partnership")).toBe(
			"Annual plan",
		);
		expect(partnerships.resolveApplicationPath("Adoption Advisory")).toBe(
			"90-day partnership",
		);
	});

	it("uses configured source attribution when the Deal attribute exists", async () => {
		workerEnv.ATTIO_SOURCE_ATTRIBUTE = "lead_source";
		workerEnv.ATTIO_SOURCE_VALUE = "Website";
		mockCreatedPath();

		await apply.handler(input, context);

		const calls = vi.mocked(fetch).mock.calls;
		expect(calls[4]![0]).toBe(
			"https://api.attio.com/v2/objects/deals/attributes/lead_source",
		);
		expect(requestBody(calls[5]!).data.title).not.toContain("Source");
		expect(requestBody(calls[6]!).data.values.lead_source).toBe("Website");
	});

	it("falls back to the note title when the source attribute is missing", async () => {
		mockCreatedPath({ attribute: ok(404) });

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});

		const calls = vi.mocked(fetch).mock.calls;
		expect(requestBody(calls[5]!).data.title).toContain(
			"Source: Inbound: partnerships page",
		);
		expect(requestBody(calls[6]!).data.values).not.toHaveProperty("source");
	});

	it("returns a mailto fallback when a core Attio write fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValueOnce(ok(500));

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: false,
			fallback: "mailto",
			code: "crm_lookup_failed",
		});
		expect(fetch).toHaveBeenCalledOnce();
		expect(callUrl(vi.mocked(fetch).mock.calls[0]!)).toBe(
			`${COMPANY_RECORDS}/query`,
		);
		expectNoUpsert();
	});

	it("does not create a company when the lookup response is unusable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: false,
			fallback: "mailto",
			code: "crm_lookup_failed",
		});
		expect(fetch).toHaveBeenCalledOnce();
		expect(callUrl(vi.mocked(fetch).mock.calls[0]!)).toBe(
			`${COMPANY_RECORDS}/query`,
		);
	});

	it("submits a full enquiry and queries Attio with verbose equality filters", async () => {
		mockCreatedPath();
		const submitted = apply.input.parse({
			name: " Ada Lovelace ",
			email: "ada@analytical.engine",
			company: " Analytical Engine ",
			path: "Product review",
			message: " Please review our Kubernetes quick start. ",
			website: "",
		});

		await expect(apply.handler(submitted, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});

		const calls = vi.mocked(fetch).mock.calls;
		expect(requestBody(calls[0]!)).toEqual({
			filter: { domains: { domain: { $eq: "analytical.engine" } } },
			limit: 1,
		});
		expect(requestBody(calls[1]!).data.values).toEqual({
			name: "Analytical Engine",
			domains: ["analytical.engine"],
		});
		expect(requestBody(calls[2]!)).toEqual({
			filter: {
				email_addresses: {
					email_address: { $eq: "ada@analytical.engine" },
				},
			},
			limit: 1,
		});
		expect(requestBody(calls[3]!).data.values.email_addresses).toEqual([
			"ada@analytical.engine",
		]);
		expect(requestBody(calls[5]!).data).toMatchObject({
			parent_object: "people",
			parent_record_id: "person-id",
			content: "Please review our Kubernetes quick start.",
		});
		expect(requestBody(calls[6]!).data.values).toMatchObject({
			name: "Analytical Engine: Product review",
			value: 5000,
			offer: "Review",
		});
		expect(fetch).toHaveBeenCalledTimes(7);
	});

	it("logs an Attio lookup failure code without sending the provider message to the client", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse(
				{
					code: "filter_error",
					message: "domains filter rejected ada@analytical.engine",
				},
				400,
			),
		);

		const result = await apply.handler(apply.input.parse(input), context);

		expect(result).toEqual({
			success: false,
			fallback: "mailto",
			code: "crm_lookup_failed",
		});
		expect(result).not.toHaveProperty("message");
		const loggedText = JSON.stringify(logged.mock.calls);
		expect(loggedText).toContain("crm_lookup_failed");
		expect(loggedText).toContain("filter_error");
		expect(loggedText).toContain("400");
		expect(loggedText).not.toContain("ada@analytical.engine");
		expect(loggedText).not.toContain("domains filter rejected");
		expect(fetch).toHaveBeenCalledOnce();
	});

	it.each([
		["company", 1],
		["person", 3],
	] as const)("returns crm_write_failed when the %s record write is rejected", async (_record, failingCall) => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		const responses = [
			emptyQuery(),
			recordResponse("company-id"),
			emptyQuery(),
			recordResponse("person-id"),
		];
		responses[failingCall] = providerRejection(
			"validation_type",
			`rejected ${input.email}`,
			422,
		);
		for (const response of responses.slice(0, failingCall + 1)) {
			vi.mocked(fetch).mockResolvedValueOnce(response);
		}

		const result = await apply.handler(input, context);

		expectSanitizedFallback(
			result,
			"crm_write_failed",
			logged,
			[input.email, "rejected"],
			["validation_type", "422"],
		);
		expect(fetch).toHaveBeenCalledTimes(failingCall + 1);
	});

	it("returns crm_note_failed when the enquiry note is rejected", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		mockCreatedPath({
			note: providerRejection(
				"unauthorized",
				`note included ${input.message}`,
				403,
			),
		});

		const result = await apply.handler(input, context);

		expectSanitizedFallback(
			result,
			"crm_note_failed",
			logged,
			[input.message, "note included"],
			["unauthorized", "403"],
		);
		expect(callUrl(vi.mocked(fetch).mock.calls.at(-1)!)).toBe(NOTES);
	});

	it("returns crm_unavailable when Attio cannot be reached", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(fetch).mockRejectedValueOnce(
			new Error(`socket hang up for ${input.email}`),
		);

		const result = await apply.handler(input, context);

		expectSanitizedFallback(result, "crm_unavailable", logged, [
			input.email,
			"socket hang up",
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("leaves an existing company and person untouched and asks for a review", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(matchedQuery("company-real"))
			.mockResolvedValueOnce(matchedQuery("person-real"))
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(recordResponse("deal-id"));
		const submitted = {
			...input,
			name: "Impostor",
			email: "Ada@Gmail.com",
			company: "Not Gmail",
		};

		await expect(apply.handler(submitted, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});

		const calls = vi.mocked(fetch).mock.calls;
		expect(requestBody(calls[0]!)).toEqual({
			filter: { domains: { domain: { $eq: "gmail.com" } } },
			limit: 1,
		});
		expect(requestBody(calls[1]!)).toEqual({
			filter: {
				email_addresses: { email_address: { $eq: "ada@gmail.com" } },
			},
			limit: 1,
		});
		expect(calls.filter((call) => callUrl(call) === COMPANY_RECORDS)).toEqual(
			[],
		);
		expect(calls.filter((call) => callUrl(call) === PERSON_RECORDS)).toEqual(
			[],
		);
		expectNoUpsert();
		const notes = noteCalls().map((call) => requestBody(call).data);
		expect(notes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					parent_object: "companies",
					parent_record_id: "company-real",
					title: "Review partnership enquiry: existing company",
				}),
				expect.objectContaining({
					parent_object: "people",
					parent_record_id: "person-real",
					title: "Review partnership enquiry: existing person",
				}),
				expect.objectContaining({
					parent_object: "people",
					parent_record_id: "person-real",
					content: submitted.message,
				}),
			]),
		);
		expect(notes.map((note) => note.content).join("\n")).toContain("Not Gmail");
		expect(notes.map((note) => note.content).join("\n")).toContain("Impostor");
		const recordWrites = calls.filter((call) =>
			[COMPANY_RECORDS, PERSON_RECORDS].includes(callUrl(call)),
		);
		expect(JSON.stringify(recordWrites)).not.toContain("Not Gmail");
		expect(JSON.stringify(recordWrites)).not.toContain("Impostor");
		expect(requestBody(calls[6]!).data.values).toMatchObject({
			associated_company: {
				target_object: "companies",
				target_record_id: "company-real",
			},
			associated_people: [
				{
					target_object: "people",
					target_record_id: "person-real",
				},
			],
		});
	});

	it("creates a missing person without changing an existing company", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(matchedQuery("company-real"))
			.mockResolvedValueOnce(emptyQuery())
			.mockResolvedValueOnce(recordResponse("person-new"))
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(recordResponse("deal-id"));

		await expect(
			apply.handler({ ...input, company: "Different name" }, context),
		).resolves.toEqual({ success: true, accepted: true });

		const calls = vi.mocked(fetch).mock.calls;
		expect(calls.filter((call) => callUrl(call) === COMPANY_RECORDS)).toEqual(
			[],
		);
		expect(callUrl(calls[2]!)).toBe(PERSON_RECORDS);
		expect(requestBody(calls[2]!).data.values.company[0].target_record_id).toBe(
			"company-real",
		);
		expect(requestBody(calls[4]!).data).toMatchObject({
			parent_object: "companies",
			parent_record_id: "company-real",
			title: "Review partnership enquiry: existing company",
			content: expect.stringContaining("Different name"),
		});
		expect(
			noteCalls().some((call) =>
				requestBody(call).data.title.includes("existing person"),
			),
		).toBe(false);
		expectNoUpsert();
	});

	it("creates a missing company without changing an existing person", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(emptyQuery())
			.mockResolvedValueOnce(recordResponse("company-new"))
			.mockResolvedValueOnce(matchedQuery("person-real"))
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(ok())
			.mockResolvedValueOnce(recordResponse("deal-id"));

		await expect(apply.handler(input, context)).resolves.toEqual({
			success: true,
			accepted: true,
		});

		const calls = vi.mocked(fetch).mock.calls;
		expect(callUrl(calls[1]!)).toBe(COMPANY_RECORDS);
		expect(requestBody(calls[1]!).data.values).toEqual({
			name: input.company,
			domains: ["analytical.engine"],
		});
		expect(calls.filter((call) => callUrl(call) === PERSON_RECORDS)).toEqual(
			[],
		);
		expect(requestBody(calls[4]!).data).toMatchObject({
			parent_object: "people",
			parent_record_id: "person-real",
			title: "Review partnership enquiry: existing person",
		});
		expect(requestBody(calls[4]!).data.content).toContain(input.name);
		expect(
			noteCalls().some((call) =>
				requestBody(call).data.title.includes("existing company"),
			),
		).toBe(false);
		expectNoUpsert();
	});
});
