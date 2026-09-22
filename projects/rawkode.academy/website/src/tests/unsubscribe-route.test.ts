import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@astrojs/compiler";
import { z } from "astro/zod";
import ts from "typescript";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
	resolve(testsDir, "../pages/unsubscribe.astro"),
	"utf8",
);
const newsletterSource = readFileSync(
	resolve(testsDir, "../actions/newsletter.ts"),
	"utf8",
);
const setPreference = vi.fn();
const deleteCookie = vi.fn();
const logError = vi.fn();

interface RouteState {
	scope: "email" | "account";
	email: string;
	emailError: boolean;
	errorMessage: string;
	successMessage: string;
}
interface RouteContext {
	url: URL;
	locals: { user?: { id: string } };
	request: { method: string; formData: () => Promise<FormData> };
	response: { status: number };
	cookies: { delete: typeof deleteCookie };
}
let runHandler: (Astro: RouteContext) => Promise<RouteState>;

beforeAll(async () => {
	const { ast, diagnostics } = await parse(source);
	expect(diagnostics.filter((item) => item.severity === 1)).toEqual([]);
	const frontmatter = ast.children.find((node) => node.type === "frontmatter");
	if (!frontmatter || frontmatter.type !== "frontmatter")
		throw new Error("Missing route frontmatter");
	const file = ts.createSourceFile(
		"unsubscribe.ts",
		frontmatter.value,
		ts.ScriptTarget.Latest,
		true,
	);
	const handlerSource = file.statements
		.filter((statement) => !ts.isImportDeclaration(statement))
		.map((statement) => statement.getText(file).replace(/^export\s+/, ""))
		.join("\n");
	// Use the real newsletter identity helpers without loading actions or bindings.
	const newsletter = ts.createSourceFile(
		"newsletter.ts",
		newsletterSource,
		ts.ScriptTarget.Latest,
		true,
	);
	const helpers = newsletter.statements
		.filter(
			(statement) =>
				ts.isFunctionDeclaration(statement) &&
				["createEmailId", "createLearnerId"].includes(
					statement.name?.text ?? "",
				),
		)
		.map((statement) => statement.getText(newsletter).replace(/^export\s+/, ""))
		.join("\n");
	const { outputText } = ts.transpileModule(`${helpers}\n${handlerSource}`, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
		},
	});
	const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
	const execute = new AsyncFunction(
		"Astro",
		"env",
		"z",
		"createLogger",
		"academyForms",
		"academyDocument",
		`${outputText}\nreturn { scope, email, emailError, errorMessage, successMessage };`,
	);
	runHandler = (Astro) =>
		execute(
			Astro,
			{ EMAIL_PREFERENCES: { setPreference } },
			z,
			() => ({ error: logError }),
			() => ({}),
			() => ({}),
		);
});

beforeEach(() => {
	setPreference.mockReset().mockResolvedValue({ success: true });
	deleteCookie.mockReset();
	logError.mockReset();
});
afterEach(() => expect(fetch).not.toHaveBeenCalled());

async function request({
	signedIn = false,
	query = "",
	fields,
	method = fields ? "POST" : "GET",
}: {
	signedIn?: boolean;
	query?: string;
	fields?: Array<[string, string | Blob]>;
	method?: string;
} = {}) {
	const data = new FormData();
	for (const [name, value] of fields ?? []) data.append(name, value);
	const formData = vi.fn().mockResolvedValue(data);
	const Astro: RouteContext = {
		url: new URL(`https://rawkode.academy/unsubscribe${query}`),
		locals: signedIn ? { user: { id: "learner-123" } } : {},
		request: { method, formData },
		response: { status: 200 },
		cookies: { delete: deleteCookie },
	};
	return {
		state: await runHandler(Astro),
		status: Astro.response.status,
		formData,
	};
}

describe("Unsubscribe route: explicit identity and confirmed POST results", () => {
	it.each([
		{ signedIn: true, query: "?email=reader@example.com", scope: "email" },
		{ signedIn: true, query: "?email=", scope: "email" },
		{ signedIn: true, query: "?scope=email", scope: "email" },
		{ signedIn: true, query: "", scope: "account" },
		{ signedIn: false, query: "", scope: "email" },
		{ signedIn: false, query: "?scope=account", scope: "email" },
		{ signedIn: true, query: "?success=true", scope: "account" },
		{
			signedIn: false,
			query: "?success=true&email=reader@example.com",
			scope: "email",
		},
	])("GET selects $scope UI without writes: $query, signed in=$signedIn", async ({
		signedIn,
		query,
		scope,
	}) => {
		const { state, formData } = await request({ signedIn, query });
		expect(state.scope).toBe(scope);
		expect(state.successMessage).toBe("");
		expect(state.errorMessage).toBe("");
		expect(formData).not.toHaveBeenCalled();
		expect(setPreference).not.toHaveBeenCalled();
		expect(deleteCookie).not.toHaveBeenCalled();
	});

	it.each([
		true,
		false,
	])("email POST mutates only the normalized email identity (signed in=%s)", async (signedIn) => {
		const { state, status } = await request({
			signedIn,
			query: "?email=other@example.com&success=true",
			fields: [
				["scope", "email"],
				["email", " Reader@Example.com "],
			],
		});
		expect(status).toBe(200);
		expect(setPreference).toHaveBeenCalledExactlyOnceWith(
			"email:reader@example.com",
			{
				audience: "academy",
				channel: "newsletter",
				status: "unsubscribed",
				source: "website:newsletter:/unsubscribe",
			},
		);
		expect(state.successMessage).toContain("reader@example.com");
		expect(state.successMessage).toContain(
			"account subscription, if any, is unchanged",
		);
		expect(deleteCookie).toHaveBeenCalledExactlyOnceWith(
			"newsletter:academy:updates",
			{ path: "/" },
		);
	});

	it("account POST honors explicit scope even with email query/body and changes only the signed-in account", async () => {
		const { state, status } = await request({
			signedIn: true,
			query: "?email=other@example.com",
			fields: [
				["scope", "account"],
				["email", "other@example.com"],
			],
		});
		expect(status).toBe(200);
		expect(setPreference).toHaveBeenCalledTimes(1);
		expect(setPreference.mock.calls[0]?.[0]).toBe("learner:learner-123");
		expect(state.successMessage).toContain("signed-in account");
		expect(state.successMessage).toContain(
			"separate email-address subscription is unchanged",
		);
		expect(deleteCookie).not.toHaveBeenCalled();
	});

	it("rejects anonymous account POST without falling back to the supplied email", async () => {
		const { state, status } = await request({
			fields: [
				["scope", "account"],
				["email", "reader@example.com"],
			],
		});
		expect(status).toBe(401);
		expect(state.errorMessage).toContain("Sign in");
		expect(state.successMessage).toBe("");
		expect(setPreference).not.toHaveBeenCalled();
	});

	it.each([
		{ scopeFields: [] },
		{ scopeFields: [["scope", "invalid"]] },
		{
			scopeFields: [
				["scope", "email"],
				["scope", "account"],
			],
		},
	] satisfies Array<{
		scopeFields: Array<[string, string]>;
	}>)("rejects missing, invalid or ambiguous POST scope: $scopeFields", async ({
		scopeFields,
	}) => {
		const { state, status } = await request({
			signedIn: true,
			query: "?scope=email&success=true",
			fields: [...scopeFields, ["email", "reader@example.com"]],
		});
		expect(status).toBe(400);
		expect(state.successMessage).toBe("");
		expect(state.email).toBe("reader@example.com");
		expect(setPreference).not.toHaveBeenCalled();
	});

	it.each([
		"",
		"not-an-email",
		"reader@",
		"<script>@example.com",
	])("rejects invalid email %j and retains its value", async (email) => {
		const { state, status } = await request({
			signedIn: true,
			fields: [
				["scope", "email"],
				["email", email],
			],
		});
		expect(status).toBe(400);
		expect(state).toMatchObject({
			email,
			emailError: true,
			scope: "email",
			successMessage: "",
		});
		expect(setPreference).not.toHaveBeenCalled();
	});

	it("rejects duplicate email addresses without choosing either identity", async () => {
		const { status } = await request({
			fields: [
				["scope", "email"],
				["email", "one@example.com"],
				["email", "two@example.com"],
			],
		});
		expect(status).toBe(400);
		expect(setPreference).not.toHaveBeenCalled();
	});

	it.each([
		"rejected",
		"unconfirmed",
	])("keeps the email form on %s service result, despite forged success query", async (failure) => {
		if (failure === "rejected")
			setPreference.mockRejectedValueOnce(new Error("offline fixture"));
		else setPreference.mockResolvedValueOnce({ success: false });
		const { state, status } = await request({
			signedIn: true,
			query: "?success=true",
			fields: [
				["scope", "email"],
				["email", "Reader@Example.com"],
			],
		});
		expect(status).toBe(503);
		expect(state).toMatchObject({
			email: "reader@example.com",
			scope: "email",
			successMessage: "",
			emailError: false,
		});
		expect(state.errorMessage).toContain("Please try again");
		expect(setPreference).toHaveBeenCalledTimes(1);
		expect(deleteCookie).not.toHaveBeenCalled();
	});

	it("binds the UI to the selected scope, retained email and actual result", () => {
		expect(source).toContain('name="scope" value={scope}');
		expect(source).toContain('scope === "email" && <label');
		expect(source).toContain('name="email" value={email}');
		expect(source).toContain('href="/unsubscribe?scope=email"');
		expect(source).toContain("Unsubscribe my account");
		expect(source).toContain("{successMessage ?");
		expect(source).not.toContain('searchParams.get("success")');
		expect(source).not.toContain("Astro.redirect");
	});
});
