import { readFileSync } from "node:fs";
import { escapeHtml } from "@rawkodeacademy/rich-text";
import { z } from "astro/zod";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
const send = vi.fn();
const workerEnv = {
	PARTNERSHIP_FORM_RATE_LIMITER: { limit },
	PARTNERSHIP_EMAIL: { send } as { send: typeof send } | undefined,
};
const loadModule = (
	filename: string,
	imports: Record<string, unknown> = {},
) => {
	const output = ts.transpileModule(readFileSync(filename, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const module = { exports: {} as Record<string, unknown> };
	new Function("require", "module", "exports", output)(
		(id: string) => {
			if (!(id in imports)) throw new Error(`Unexpected import ${id}`);
			return imports[id];
		},
		module,
		module.exports,
	);
	return module.exports;
};
const partnerships = loadModule(
	"src/lib/partnerships.ts",
) as typeof import("@/lib/partnerships");
type Action = {
	accept?: string;
	input: { parse: (value: unknown) => Record<string, unknown> };
	handler: (
		input: Record<string, unknown>,
		context: { request: Request },
	) => Promise<Record<string, unknown>>;
};
const { partnership } = loadModule("src/actions/partnership.ts", {
	"@rawkodeacademy/rich-text": { escapeHtml },
	"astro:actions": { defineAction: (definition: unknown) => definition },
	"astro/zod": { z },
	"cloudflare:workers": { env: workerEnv },
	"@/lib/partnerships": partnerships,
}) as { partnership: { apply: Action; applyForm: Action } };
const { apply, applyForm } = partnership;
const input = {
	name: "Ada Lovelace",
	email: "ada@analytical.engine",
	company: "Analytical Engine",
	path: "Partnership",
	message: "Please review our Kubernetes quick start.",
	website: "",
};
const context = {
	request: new Request("https://rawkode.academy/_actions/partnership.apply", {
		headers: { "CF-Connecting-IP": "192.0.2.10" },
	}),
};
const submit = (values = input) =>
	apply.handler(apply.input.parse(values), context);

beforeEach(() => {
	workerEnv.PARTNERSHIP_EMAIL = { send };
	limit.mockReset().mockResolvedValue({ success: true });
	send.mockReset().mockResolvedValue({ messageId: "test-message" });
	vi.stubGlobal("fetch", vi.fn());
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("partnership email action", () => {
	it.each(
		partnerships.applicationPaths,
	)("emails a complete %s enquiry to David", async (path) => {
		await expect(submit({ ...input, path })).resolves.toEqual({
			success: true,
			accepted: true,
		});
		expect(send).toHaveBeenCalledOnce();
		const message = send.mock.calls[0]![0];
		expect(message).toMatchObject({
			from: { email: "david@rawkode.email", name: "Rawkode Academy enquiries" },
			to: "david@rawkode.academy",
			replyTo: input.email,
			subject: `Partnership enquiry: ${partnerships.applicationPathLabels[path]}`,
		});
		for (const value of [
			input.name,
			input.email,
			input.company,
			input.message,
			partnerships.applicationPathLabels[path],
		]) {
			expect(message.text).toContain(value);
			expect(message.html).toContain(value);
		}
		expect(fetch).not.toHaveBeenCalled();
	});

	it("uses the same validation and delivery for native form posts", async () => {
		expect(applyForm.accept).toBe("form");
		expect(applyForm.input).toBe(apply.input);
		expect(applyForm.handler).toBe(apply.handler);
		await expect(
			applyForm.handler(applyForm.input.parse(input), context),
		).resolves.toEqual({
			success: true,
			accepted: true,
		});
		expect(send).toHaveBeenCalledOnce();
	});

	it("awaits the email service before reporting an accepted enquiry", async () => {
		let accept!: (value: { messageId: string }) => void;
		send.mockReturnValueOnce(
			new Promise((resolve) => {
				accept = resolve;
			}),
		);
		let settled = false;
		const pending = submit().then((result) => {
			settled = true;
			return result;
		});
		await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
		expect(settled).toBe(false);
		accept({ messageId: "accepted-message" });
		await expect(pending).resolves.toEqual({ success: true, accepted: true });
	});

	it("accepts honeypot submissions without sending email or counting a lead", async () => {
		await expect(
			submit({ ...input, website: "https://spam.test" }),
		).resolves.toEqual({
			success: true,
			accepted: false,
		});
		expect(limit).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});

	it("rate limits before sending and hashes the client address", async () => {
		limit.mockResolvedValue({ success: false });
		await expect(submit()).resolves.toEqual({
			success: false,
			rateLimited: true,
		});
		expect(limit).toHaveBeenCalledOnce();
		expect(limit.mock.calls[0]![0].key).toMatch(/^[a-f0-9]{64}$/);
		expect(limit.mock.calls[0]![0].key).not.toContain("192.0.2.10");
		expect(send).not.toHaveBeenCalled();
	});

	it("does not send when the rate limiter is unavailable", async () => {
		limit.mockRejectedValue(new Error("unavailable"));
		await expect(submit()).resolves.toEqual({
			success: false,
			fallback: "mailto",
			code: "enquiry_unavailable",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("returns a mailto fallback when the email binding is absent", async () => {
		workerEnv.PARTNERSHIP_EMAIL = undefined;
		await expect(submit()).resolves.toEqual({
			success: false,
			fallback: "mailto",
			code: "email_unconfigured",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("preserves plain text and escapes all submitted HTML", async () => {
		const values = {
			...input,
			name: 'Zoë <img src=x onerror="alert(1)">',
			company: 'R&D "Labs"\r\nBcc: attacker@example.com',
			message: "<script>alert(1)</script>\nWe use Rust & Kubernetes. 👋",
		};
		await submit(values);
		const message = send.mock.calls[0]![0];
		for (const value of [values.name, values.company, values.message]) {
			expect(message.text).toContain(value);
			expect(message.html).toContain(escapeHtml(value));
		}
		expect(message.html).not.toContain("<img");
		expect(message.html).not.toContain("<script");
		expect(message.html).toContain("white-space: pre-wrap");
		expect(message.subject).toBe("Partnership enquiry: Partnership");
		expect(message).not.toHaveProperty("bcc");
		expect(message).not.toHaveProperty("cc");
		expect(message).not.toHaveProperty("headers");
	});

	it("ignores submitted sender and recipient overrides", async () => {
		await apply.handler(
			apply.input.parse({
				...input,
				to: "attacker@example.com",
				from: "forged@example.com",
				replyTo: "other@example.com",
			}),
			context,
		);
		expect(send.mock.calls[0]![0]).toMatchObject({
			to: "david@rawkode.academy",
			from: { email: "david@rawkode.email" },
			replyTo: input.email,
		});
	});

	it("offers a fallback on delivery failure without exposing private data", async () => {
		send.mockRejectedValue(
			Object.assign(new Error(`${input.email}: ${input.message}`), {
				code: input.name,
			}),
		);
		const result = await submit();
		expect(result).toEqual({
			success: false,
			fallback: "mailto",
			code: "email_send_failed",
		});
		expect(send).toHaveBeenCalledOnce();
		const output = JSON.stringify([
			result,
			vi.mocked(console.error).mock.calls,
		]);
		for (const value of [
			input.email,
			input.message,
			input.name,
			input.company,
		]) {
			expect(output).not.toContain(value);
		}
	});

	it.each([
		{ name: " " },
		{ name: "x".repeat(201) },
		{ email: "not-an-email" },
		{ email: "ada@example.com\r\nBcc: attacker@example.com" },
		{ company: " " },
		{ company: "x".repeat(1001) },
		{ message: " " },
		{ message: "x".repeat(5001) },
		{ path: "unknown" },
		{ path: "constructor" },
	])("rejects invalid input before any delivery: %j", (invalid) => {
		expect(() => apply.input.parse({ ...input, ...invalid })).toThrow();
		expect(send).not.toHaveBeenCalled();
	});

	it("limits the deployed binding to David's inbox", () => {
		const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
		expect(config.send_email).toContainEqual({
			name: "PARTNERSHIP_EMAIL",
			destination_address: "david@rawkode.academy",
		});
	});
});

describe("partnership enquiry routes", () => {
	it.each(
		partnerships.applicationPaths,
	)("keeps the current %s route selectable", (route) => {
		expect(partnerships.resolveApplicationPath(route)).toBe(route);
	});

	it.each([
		["Customer workshops", "Bespoke project"],
		["Event content and hosting", "Bespoke project"],
		["Community Support", "Support the Academy"],
		["Community supporter", "Support the Academy"],
		["Hands-on content", "Partnership"],
		["Developer support", "Partnership"],
		["Ongoing partnership", "Partnership"],
		["Product review", "Partnership"],
		["Adoption review", "Partnership"],
		["First-run review", "Partnership"],
		["Fit & Proof Review", "Partnership"],
		["Production review", "Partnership"],
		["Annual partnership", "Partnership"],
		["Annual plan", "Partnership"],
		["90-day partnership", "Partnership"],
		["Adoption Advisory", "Partnership"],
	])("maps the legacy %s link to %s", (previous, current) => {
		expect(partnerships.resolveApplicationPath(previous)).toBe(current);
	});
	it.each([
		"unknown",
		"constructor",
		"toString",
		"__proto__",
		"",
	])("ignores an unrecognised route: %s", (route) => {
		expect(partnerships.resolveApplicationPath(route)).toBeUndefined();
	});
});
