// Run with: node --import tsx --test src/tests/form-hydration.test.mjs
// Compile the real SFCs; replace only action/network and analytics boundaries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
const website = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const window = new Window({ url: "https://local.test/courses/example" });
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"SVGElement",
	"Event",
	"MouseEvent",
	"MutationObserver",
	"HTMLInputElement",
	"HTMLSelectElement",
	"HTMLTextAreaElement",
	"getComputedStyle",
	"requestAnimationFrame",
	"cancelAnimationFrame",
]) {
	const value = name === "window" ? window : window[name];
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value:
			typeof value === "function" && /^[a-z]/.test(name)
				? value.bind(window)
				: value,
	});
}
const unexpectedFetch = () => {
	throw new Error("Real network requests are forbidden");
};
globalThis.fetch = unexpectedFetch;
const vue = require("vue");
const { renderToString } = require("vue/server-renderer");
const { parse, compileScript } = require("vue/compiler-sfc");
const ts = require("typescript");
const css = await import(
	"../../../../../packages/design-system/styled-system/css/index.js"
);

function evaluate(source, filename, resolveImport = require) {
	const { outputText } = ts.transpileModule(source, {
		fileName: filename,
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
		},
	});
	const module = { exports: {} };
	new Function("require", "module", "exports", outputText)(
		resolveImport,
		module,
		module.exports,
	);
	return module.exports;
}
const designSystem = evaluate(
	readFileSync(
		resolve(
			website,
			"../../../packages/design-system/src/recipes/academyForms.ts",
		),
		"utf8",
	),
	"academyForms.ts",
	() => css,
);
let calls = [];
let respond;
const action = async (payload) => {
	calls.push(payload);
	return new Promise((resolveResponse) => {
		respond = resolveResponse;
	});
};
const mocks = {
	"@rawkodeacademy/design-system": designSystem,
	"astro:actions": {
		actions: { signupForCourseUpdates: action, partnership: { apply: action } },
		isInputError: (error) => Boolean(error.fields),
	},
	"@/lib/analytics/attribution": {
		getSessionCampaignAttribution: () => ({ campaign: "test" }),
		serializeCampaignAttribution: () => "attribution-test",
	},
	"@/lib/partnerships": evaluate(
		readFileSync(resolve(website, "src/lib/partnerships.ts"), "utf8"),
		"partnerships.ts",
	),
};
function component(file, ssr = false) {
	const filename = resolve(website, "src/components", file);
	const { descriptor, errors } = parse(readFileSync(filename, "utf8"), {
		filename,
	});
	assert.deepEqual(errors, []);
	const script = compileScript(descriptor, {
		id: file,
		inlineTemplate: true,
		templateOptions: { ssr },
	});
	return evaluate(
		script.content,
		`${file}.ts`,
		(id) => mocks[id] ?? require(id),
	).default;
}
const flush = async () => {
	await new Promise((resolveTick) => setImmediate(resolveTick));
	await vue.nextTick();
};
const common = {
	courseId: "example",
	courseTitle: "Example",
	pagePath: "/courses/example",
};
const signup = {
	audienceId: "audience",
	sponsor: "Sponsor",
	sponsorAudienceId: "sponsor",
	allowSponsorContact: true,
};
const fixtures = [
	{
		file: "courses/CourseSignupFormClient.vue",
		props: { ...common, ...signup },
	},
	{
		file: "courses/CourseSignupFormCompact.vue",
		props: { ...common, signupConfig: signup },
	},
	{
		file: "organizations/PartnershipApplicationForm.vue",
		props: {},
		partnership: true,
	},
];
async function render(fixture, extraProps = {}) {
	const props = { ...fixture.props, ...extraProps };
	return renderToString(vue.createSSRApp(component(fixture.file, true), props));
}
async function hydrate(fixture, extraProps = {}) {
	const host = document.createElement("div");
	host.innerHTML = await render(fixture, extraProps);
	document.body.append(host);
	const app = vue.createSSRApp(component(fixture.file), {
		...fixture.props,
		...extraProps,
	});
	const warnings = [];
	app.config.warnHandler = (message) => warnings.push(message);
	app.mount(host);
	await flush();
	assert.deepEqual(warnings, [], "SSR/client hydration should agree");
	return {
		host,
		close: () => {
			app.unmount();
			host.remove();
		},
	};
}
function setValue(host, name, value) {
	const input = host.querySelector(`[name="${name}"]`);
	assert.ok(input, name);
	input.value = value;
	input.dispatchEvent(new window.Event("input", { bubbles: true }));
	input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("lesson signup has one heading, one purpose statement and no nested card or consent notice", async () => {
	const styles = designSystem.academyForms();
	for (const allowSponsorContact of [true, false]) {
		const host = document.createElement("div");
		host.innerHTML = await render(fixtures[0], { allowSponsorContact });
		assert.deepEqual(
			Array.from(
				host.querySelectorAll("h2, h3, h4"),
				(heading) => heading.textContent,
			),
			["Course updates"],
		);
		assert.equal(
			host.querySelector("section").getAttribute("aria-labelledby"),
			host.querySelector("h2").id,
		);
		assert.equal(
			host.textContent.split(
				"Get email updates when new course content is available.",
			).length - 1,
			1,
		);
		assert.doesNotMatch(
			host.textContent,
			/Stay updated as this course grows|Sign up once|Sign up to receive|By signing up/,
		);
		const countSlot = (slot) =>
			Array.from(host.querySelectorAll("[class]")).filter((element) =>
				styles[slot]
					.split(/\s+/)
					.every((name) => element.classList.contains(name)),
			).length;
		for (const slot of ["panel", "notice", "kicker", "consent"]) {
			assert.equal(countSlot(slot), 0, `No ${slot} wrapper`);
		}
		assert.equal(countSlot("section"), 1, "One outer surface");
		assert.equal(
			host.querySelectorAll('[name="allowSponsorContact"]').length,
			allowSponsorContact ? 1 : 0,
		);
	}
});

for (const fixture of fixtures.filter((item) => !item.partnership)) {
	test(`${fixture.file}: consent label is the 44px target and toggles only the associated checkbox`, async () => {
		const styles = designSystem.academyForms.raw();
		assert.equal(styles.courseConsent["& > label"].minHeight, "11");
		assert.equal(styles.courseConsent["& > label"].minWidth, "0");
		assert.equal(styles.courseConsent["& > label"].flex, "1");
		assert.equal(styles.courseConsent["& > label"].padding, undefined);
		assert.equal(styles.copy.overflowWrap, "anywhere");
		assert.equal(styles.checkbox.flexShrink, "0");
		assert.equal(styles.checkbox._focusVisible.outline, "focus");
		calls = [];
		const view = await hydrate(fixture);
		try {
			const checkbox = view.host.querySelector('[name="allowSponsorContact"]');
			const label = view.host.querySelector(`label[for="${checkbox.id}"]`);
			label.click();
			await flush();
			assert.equal(checkbox.checked, true);
			assert.equal(calls.length, 0, "Consent selection alone does not submit");
			label.click();
			await flush();
			assert.equal(checkbox.checked, false);
		} finally {
			view.close();
		}
	});

	test(`${fixture.file}: sponsor label discloses optional email sharing and full marketing scope`, async () => {
		const host = document.createElement("div");
		host.innerHTML = await render(fixture);
		const consent = host.querySelector('[name="allowSponsorContact"]');
		assert.equal(consent.checked, false);
		assert.equal(consent.required, false);
		assert.equal(
			host.querySelector(`label[for="${consent.id}"]`).textContent,
			"Optional: share my email with Sponsor so they can contact me with relevant offers and product updates.",
		);
		assert.doesNotMatch(host.textContent, /for course-related updates/);
	});
}

for (const fixture of fixtures) {
	test(`${fixture.file}: SSR is POST-only with all controls inside a disabled fieldset`, async () => {
		calls = [];
		const host = document.createElement("div");
		host.innerHTML = await render(fixture);
		const form = host.querySelector("form");
		assert.equal(form.method.toLowerCase(), "post");
		assert.equal(form.hasAttribute("novalidate"), false);
		assert.equal(form.getAttribute("aria-busy"), "true");
		const fieldset = form.querySelector("fieldset");
		assert.equal(fieldset.disabled, true);
		assert.ok(fieldset.getAttribute("aria-label"));
		for (const control of form.querySelectorAll(
			"input, select, textarea, button",
		)) {
			assert.equal(control.closest("fieldset"), fieldset);
			assert.equal(
				control.closest("legend"),
				null,
				"No fieldset disabled exception",
			);
			assert.equal(
				control.hasAttribute("formmethod"),
				false,
				"No GET override",
			);
		}
		assert.match(
			host.querySelector('[role="status"]').textContent,
			/Loading .* form/,
		);
		const fallback = form.querySelector("noscript").innerHTML;
		assert.match(fallback, /JavaScript is required/);
		// Text-only noscript avoids SSR hydration mismatch when scripting-enabled
		// HTML parsers treat noscript contents as raw text rather than elements.
		assert.equal(form.querySelector("noscript").children.length, 0);
		if (fixture.partnership)
			assert.ok(form.querySelector('a[href="mailto:david@rawkode.academy"]'));
		else
			assert.match(
				fallback,
				/Course content remains available without signing up/,
			);
		assert.equal(calls.length, 0, "SSR must not invoke actions");
	});

	test(`${fixture.file}: hydration restores validation, mocked action, errors and retry`, async () => {
		calls = [];
		const view = await hydrate(fixture);
		try {
			const { host } = view;
			const form = host.querySelector("form");
			assert.equal(form.querySelector("fieldset").disabled, false);
			assert.equal(form.getAttribute("aria-busy"), "false");
			assert.equal(
				form.checkValidity(),
				false,
				"Empty required fields remain invalid",
			);
			form.requestSubmit();
			assert.equal(
				calls.length,
				0,
				"Native validation prevents invalid submission",
			);
			setValue(host, "email", "not-an-email");
			assert.equal(form.checkValidity(), false);
			setValue(host, "email", "person@example.test");
			if (fixture.partnership) {
				for (const [name, value] of Object.entries({
					name: "Test Person",
					company: "Test Company",
					targetDevelopers: "Platform teams",
					challenge: "Adoption challenge",
				}))
					setValue(host, name, value);
			}
			for (const input of form.querySelectorAll(
				"input:not([type=hidden]),select,textarea",
			)) {
				assert.ok(input.id);
				assert.ok(
					form.querySelector(`label[for="${input.id}"]`),
					`Label for ${input.name}`,
				);
			}
			assert.equal(form.checkValidity(), true);
			let prevented = false;
			form.addEventListener("submit", (event) => {
				prevented = event.defaultPrevented;
			});
			form.requestSubmit();
			await vue.nextTick();
			assert.equal(
				prevented,
				true,
				"Hydrated handler prevents native navigation",
			);
			assert.equal(calls.length, 1);
			assert.equal(form.querySelector("fieldset").disabled, true);
			assert.equal(form.querySelector("button").disabled, true);
			assert.match(
				host.querySelector("[role=status]").textContent,
				/Sending|Submitting/,
			);
			form.dispatchEvent(
				new window.Event("submit", { bubbles: true, cancelable: true }),
			);
			assert.equal(calls.length, 1, "Pending request cannot be duplicated");
			if (fixture.partnership) {
				assert.deepEqual(calls[0], {
					name: "Test Person",
					email: "person@example.test",
					company: "Test Company",
					path: "Not sure yet",
					targetDevelopers: "Platform teams",
					challenge: "Adoption challenge",
				});
				respond({ error: { fields: { email: ["Please check this email"] } } });
			} else {
				assert.deepEqual(Object.fromEntries(calls[0]), {
					audienceId: "audience",
					email: "person@example.test",
					allowSponsorContact: "false",
					source: "website:course-signup:example:/courses/example",
					attribution: "attribution-test",
					sponsorAudienceId: "sponsor",
				});
				respond({ error: { message: "Please try again" } });
			}
			await flush();
			assert.equal(form.querySelector("fieldset").disabled, false);
			assert.equal(
				host.querySelector("[name=email]").value,
				"person@example.test",
			);
			assert.match(
				host.querySelector("[role=alert]").textContent,
				/highlighted|try again/,
			);
			if (fixture.partnership)
				assert.equal(
					host.querySelector("[name=email]").getAttribute("aria-invalid"),
					"true",
				);
			form.requestSubmit();
			assert.equal(calls.length, 2);
			respond({ data: { success: true, message: "Check your inbox" } });
			await flush();
			if (fixture.partnership) assert.equal(host.querySelector("form"), null);
			else {
				assert.equal(host.querySelector("[type=checkbox]").checked, false);
				assert.equal(host.querySelector("button[type=submit]").disabled, true);
			}
			assert.match(
				host.querySelector("[role=status]").textContent,
				/Application received|Check your inbox/,
			);
		} finally {
			view.close();
		}
	});
}

for (const fixture of fixtures.filter((item) => !item.partnership)) {
	test(`${fixture.file}: signed-in identity and explicit consent survive hydration`, async () => {
		calls = [];
		const view = await hydrate(fixture, {
			userEmail: "signed-in@example.test",
		});
		try {
			assert.equal(view.host.querySelector("[name=email]"), null);
			const consent = view.host.querySelector("[type=checkbox]");
			assert.equal(consent.checked, false);
			consent.click();
			view.host.querySelector("form").requestSubmit();
			assert.equal(calls[0].get("email"), "signed-in@example.test");
			assert.equal(calls[0].get("allowSponsorContact"), "true");
			respond({
				data: {
					success: true,
					sponsorStatus: "subscribed",
					message: "Subscribed",
				},
			});
			await flush();
		} finally {
			view.close();
		}
	});
	test(`${fixture.file}: deferred subscription check still suppresses duplicate signup`, async () => {
		calls = [];
		const requested = [];
		globalThis.fetch = async (url) => {
			requested.push(url);
			return { ok: true, json: async () => ({ isSubscribed: true }) };
		};
		const view = await hydrate(fixture, {
			deferSubscriptionCheck: true,
			isAlreadySubscribed: undefined,
		});
		try {
			assert.deepEqual(requested, [
				"/api/subscriptions/check?audienceId=audience",
			]);
			assert.equal(view.host.querySelector("[type=checkbox]").checked, false);
			assert.equal(
				view.host.querySelector("button[type=submit]").disabled,
				true,
			);
			assert.match(
				view.host.querySelector("[role=status]").textContent,
				/subscribed/,
			);
			assert.equal(calls.length, 0);
		} finally {
			view.close();
			globalThis.fetch = unexpectedFetch;
		}
	});
}
for (const fixture of fixtures.filter((item) => !item.partnership)) {
	test(`${fixture.file}: anonymous partial-success retry retains the confirmed, readonly email`, async () => {
		calls = [];
		const view = await hydrate(fixture);
		try {
			setValue(view.host, "email", "address-a@example.test");
			const input = view.host.querySelector("[name=email]");
			assert.equal(input.readOnly, false);
			view.host.querySelector("[type=checkbox]").click();
			view.host.querySelector("form").requestSubmit();
			assert.equal(calls[0].get("email"), "address-a@example.test");
			respond({
				data: {
					success: true,
					sponsorStatus: "unconfirmed",
					message:
						"Course updates are saved. Sponsor signup could not be confirmed.",
				},
			});
			await flush();
			assert.equal(
				input.readOnly,
				true,
				"Saved identity cannot be edited to address B",
			);
			assert.equal(
				input.disabled,
				false,
				"Identity remains focusable and copyable",
			);
			assert.equal(input.value, "address-a@example.test");
			assert.equal(
				view.host.querySelector(`label[for="${input.id}"]`).textContent,
				"Email address",
			);
			assert.equal(view.host.querySelector("[type=checkbox]").checked, false);
			assert.equal(
				view.host.querySelector("button[type=submit]").disabled,
				true,
			);
			view.host.querySelector("[type=checkbox]").click();
			await flush();
			view.host.querySelector("form").requestSubmit();
			assert.equal(calls.length, 2);
			assert.equal(calls[1].get("email"), "address-a@example.test");
			assert.equal(calls[1].get("allowSponsorContact"), "true");
			respond({ error: { message: "Please retry" } });
			await flush();
			assert.equal(
				input.readOnly,
				true,
				"Retry failure must not unlock the saved identity",
			);
			assert.equal(input.value, "address-a@example.test");
		} finally {
			view.close();
		}
	});
	test(`${fixture.file}: partial success requires fresh sponsor consent; refresh retains the opt-in`, async () => {
		calls = [];
		const identity = { userEmail: "signed-in@example.test" };
		const view = await hydrate(fixture, identity);
		try {
			view.host.querySelector("[type=checkbox]").click();
			view.host.querySelector("form").requestSubmit();
			assert.equal(calls.length, 1);
			respond({
				data: {
					success: true,
					sponsorStatus: "unconfirmed",
					message:
						"Course updates are saved. Sponsor signup could not be confirmed. You can choose to retry below.",
				},
			});
			await flush();
			assert.match(
				view.host.querySelector("[role=status]").textContent,
				/Course updates are saved.*could not be confirmed/,
			);
			assert.equal(view.host.querySelector("[type=checkbox]").checked, false);
			assert.equal(
				view.host.querySelector("button[type=submit]").disabled,
				true,
			);
			assert.match(
				view.host.querySelector("button[type=submit]").textContent,
				/Retry sponsor signup/,
			);
			view.host
				.querySelector("form")
				.dispatchEvent(
					new window.Event("submit", { bubbles: true, cancelable: true }),
				);
			assert.equal(calls.length, 1, "No retry without renewed consent");
			view.host.querySelector("[type=checkbox]").click();
			await flush();
			view.host.querySelector("form").requestSubmit();
			assert.equal(calls.length, 2);
			assert.equal(calls[1].get("allowSponsorContact"), "true");
			respond({
				data: {
					success: true,
					sponsorStatus: "subscribed",
					message: "Course updates and sponsor signup are confirmed.",
				},
			});
			await flush();
			assert.equal(view.host.querySelector("form"), null);
		} finally {
			view.close();
		}

		calls = [];
		const refreshed = await hydrate(fixture, {
			...identity,
			isAlreadySubscribed: true,
		});
		try {
			assert.equal(calls.length, 0);
			assert.equal(
				refreshed.host.querySelector("[type=checkbox]").checked,
				false,
			);
			assert.equal(
				refreshed.host.querySelector("button[type=submit]").disabled,
				true,
			);
			assert.match(refreshed.host.textContent, /Course updates are saved/);
			refreshed.host.querySelector("[type=checkbox]").click();
			await flush();
			refreshed.host.querySelector("form").requestSubmit();
			assert.equal(calls.length, 1);
			assert.equal(calls[0].get("email"), identity.userEmail);
			assert.equal(calls[0].get("allowSponsorContact"), "true");
			respond({
				data: {
					success: true,
					sponsorStatus: "subscribed",
					message: "Sponsor signup confirmed.",
				},
			});
			await flush();
		} finally {
			refreshed.close();
		}
	});
}
after(async () => {
	await window.happyDOM.abort();
});
