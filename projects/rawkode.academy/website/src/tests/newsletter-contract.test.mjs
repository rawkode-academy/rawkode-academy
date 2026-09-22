// Real Vue SSR + hydration, mocked actions only; no live requests.
// node --import tsx --test src/tests/newsletter-contract.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, test } from "node:test";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
const window = new Window({ url: "https://local.test/technology/acorn" });
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"SVGElement",
	"Event",
	"HTMLInputElement",
]) {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value: name === "window" ? window : window[name],
	});
}
globalThis.fetch = () => {
	throw new Error("Live requests forbidden");
};
const vue = require("vue");
const { renderToString } = require("vue/server-renderer");
const { parse, compileScript } = require("vue/compiler-sfc");
const ts = require("typescript");
const css = await import(
	"../../../../../packages/design-system/styled-system/css/index.js"
);
const recipeSource = readFileSync(
	new URL(
		"../../../../../packages/design-system/src/recipes/academyMarketing.ts",
		import.meta.url,
	),
	"utf8",
);
const recipeModule = { exports: {} };
new Function(
	"require",
	"module",
	"exports",
	ts.transpileModule(recipeSource, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText,
)(
	(id) => {
		assert.equal(id, "../../styled-system/css");
		return css;
	},
	recipeModule,
	recipeModule.exports,
);
const { academyMarketing } = recipeModule.exports;
const source = readFileSync(
	new URL("../components/newsletter/NewsletterWidget.vue", import.meta.url),
	"utf8",
);
const { descriptor, errors } = parse(source);
assert.deepEqual(errors, []);
let calls = [];
let respond;
const action = (payload) => {
	calls.push(payload);
	return new Promise((resolve) => {
		respond = resolve;
	});
};
const mocks = {
	"astro:actions": {
		actions: { newsletter: { subscribe: action, subscribeWithEmail: action } },
	},
	"@rawkodeacademy/design-system": { academyMarketing },
	"@/lib/analytics/attribution": {
		getSessionCampaignAttribution: () => undefined,
		serializeCampaignAttribution: () => undefined,
	},
	"@/lib/analytics/growth": {
		GROWTH_EVENTS: {},
		captureGrowthClientEvent: () => {},
	},
};
function component(ssr) {
	const script = compileScript(descriptor, {
		id: "newsletter-contract",
		inlineTemplate: true,
		templateOptions: { ssr },
	});
	const output = ts.transpileModule(script.content, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const module = { exports: {} };
	new Function("require", "module", "exports", output)(
		(id) => mocks[id] ?? require(id),
		module,
		module.exports,
	);
	return module.exports.default;
}
const defaults = {
	isSignedIn: false,
	isSubscribed: false,
	pagePath: "/technology/acorn",
	signInUrl: "/api/auth/sign-in?returnTo=%2Ftechnology%2Facorn",
	audience: "technology:acorn",
};
const flush = async () => {
	await new Promise((resolve) => setImmediate(resolve));
	await vue.nextTick();
};
async function mount(extra = {}) {
	calls = [];
	document.cookie = "newsletter:technology:acorn:updates=; Max-Age=0; Path=/";
	const props = { ...defaults, ...extra };
	const host = document.createElement("div");
	host.innerHTML = await renderToString(
		vue.createSSRApp(component(true), props),
	);
	document.body.append(host);
	const app = vue.createSSRApp(component(false), props);
	const warnings = [];
	app.config.warnHandler = (warning) => warnings.push(warning);
	app.mount(host);
	await flush();
	assert.deepEqual(warnings, []);
	return {
		host,
		close: () => {
			app.unmount();
			host.remove();
		},
	};
}
async function expand(host) {
	const button = host.querySelector('button[type="button"]');
	assert.equal(button.getAttribute("aria-expanded"), "false");
	assert.equal(
		button.getAttribute("aria-controls"),
		host.querySelector("form").id,
	);
	assert.equal(host.querySelector("form").style.display, "none");
	button.click();
	await flush();
	const input = host.querySelector("input");
	assert.equal(document.activeElement, input);
	const label = host.querySelector("label");
	assert.equal(label.htmlFor, input.id);
	assert(!label.classList.contains("sr-only"));
	input.value = "reader@example.test";
	input.dispatchEvent(new window.Event("input", { bubbles: true }));
	await flush();
	return host.querySelector("form");
}

test("anonymous success is announced, retained and focused; later visit is suppressed", async () => {
	const view = await mount();
	try {
		const form = await expand(view.host);
		form.requestSubmit();
		await flush();
		assert.equal(calls.length, 1);
		assert.equal(calls[0].audience, "technology:acorn");
		assert.equal(form.getAttribute("aria-busy"), "true");
		assert.equal(
			form.querySelector("button").getAttribute("aria-label"),
			"Subscribing",
		);
		form.dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true }),
		);
		assert.equal(calls.length, 1);
		document.cookie = "newsletter:technology:acorn:updates=true; Path=/";
		respond({ data: { success: true } });
		await flush();
		const message = view.host.querySelector(
			'[role="status"] > [tabindex="-1"]',
		);
		assert.match(message.textContent, /subscription is confirmed/);
		assert.equal(message.parentElement.getAttribute("role"), "status");
		assert.equal(message.parentElement.getAttribute("aria-live"), "polite");
		assert.equal(document.activeElement, message);
		assert.equal(view.host.querySelector("form"), null);
		// Mount another visit with the cookie still set, without invoking an action.
		const nextHost = document.createElement("div");
		document.body.append(nextHost);
		const nextApp = vue.createApp(component(false), defaults);
		nextApp.mount(nextHost);
		await flush();
		assert.equal(nextHost.querySelector("button"), null);
		assert.equal(nextHost.textContent, "");
		nextApp.unmount();
		nextHost.remove();
	} finally {
		view.close();
	}
});

test("SSR controls wait for hydration and retain a native settings fallback", async () => {
	for (const isSignedIn of [false, true]) {
		const html = await renderToString(
			vue.createSSRApp(component(true), { ...defaults, isSignedIn }),
		);
		const host = document.createElement("div");
		host.innerHTML = html;
		assert.equal(host.querySelector('button[type="button"]').disabled, true);
		assert.match(host.textContent, /Loading email signup/);
		assert.equal(
			host.querySelector('a[href="/settings"]').textContent,
			"manage email preferences in account settings",
		);
	}
});

test("success does not steal focus after the reader moves elsewhere", async () => {
	const view = await mount();
	const outside = document.createElement("button");
	document.body.append(outside);
	try {
		(await expand(view.host)).requestSubmit();
		await flush();
		outside.focus();
		respond({ data: { success: true } });
		await flush();
		assert.equal(document.activeElement, outside);
		assert(view.host.querySelector('[role="status"] > [tabindex="-1"]'));
	} finally {
		view.close();
		outside.remove();
	}
});

test("errors and missing confirmation preserve email and permit retry", async () => {
	const view = await mount();
	try {
		const form = await expand(view.host);
		for (const result of [
			{ error: { message: "Try again" } },
			{ data: { success: false } },
		]) {
			form.requestSubmit();
			respond(result);
			await flush();
			assert(view.host.querySelector("[role=alert]"));
			assert.equal(form.querySelector("input").value, "reader@example.test");
			assert.equal(form.querySelector("input").disabled, false);
			assert.equal(
				view.host.querySelector('[role="status"] > [tabindex="-1"]'),
				null,
			);
		}
	} finally {
		view.close();
	}
});

test("signed-in success replaces focus; existing subscription needs no action", async () => {
	const view = await mount({ isSignedIn: true });
	try {
		const button = view.host.querySelector("button");
		button.focus();
		button.click();
		respond({ data: { success: true } });
		await flush();
		assert.equal(
			document.activeElement,
			view.host.querySelector('[role="status"] > [tabindex="-1"]'),
		);
	} finally {
		view.close();
	}
	const subscribed = await mount({ isSignedIn: true, isSubscribed: true });
	try {
		assert.match(subscribed.host.textContent, /Subscribed/);
		assert.equal(subscribed.host.querySelector("button"), null);
		assert.equal(calls.length, 0);
	} finally {
		subscribed.close();
	}
});

test("unknown preferences offer reload, not an assumed subscription action", async () => {
	const view = await mount({ isSignedIn: true, preferencesUnavailable: true });
	try {
		assert.match(
			view.host.querySelector("[role=alert]").textContent,
			/status is unavailable/,
		);
		assert.equal(
			view.host.querySelector("a").getAttribute("href"),
			defaults.pagePath,
		);
		assert.equal(view.host.querySelector("button"), null);
		assert.equal(calls.length, 0);
	} finally {
		view.close();
	}
});

test("field identifiers vary by audience/path and no cadence is promised", async () => {
	const first = await mount();
	const second = await mount({
		audience: "academy",
		pagePath: "/read/example",
	});
	try {
		assert.notEqual(
			first.host.querySelector("input").id,
			second.host.querySelector("input").id,
		);
		assert(!first.host.textContent.includes("weekly"));
	} finally {
		first.close();
		second.close();
	}
});
test("Academy newsletter recipe supplies label, target sizing and confirmation focus", async () => {
	const styles = academyMarketing.raw();
	assert.equal(styles.newsletterLabel.fontFamily, "academy-text");
	assert.equal(styles.newsletterLabel.color, "academy.text");
	assert.equal(styles.newsletterField.minHeight, "14");
	assert.equal(styles.newsletterField.paddingInlineEnd, "14");
	assert.equal(styles.newsletterSubmit.width, "11");
	assert.equal(styles.newsletterSubmit.height, "11");
	assert.equal(styles.newsletterSubmit.insetBlockStart, "1.5");
	assert.equal(styles.newsletterSuccess.margin, "0");
	assert.deepEqual(styles.newsletterSuccess._focusVisible, {
		outline: "focus",
		outlineColor: "academy.accent",
		outlineOffset: "focus",
	});
	const view = await mount();
	try {
		const classes = academyMarketing();
		assert.equal(
			view.host.querySelector("label").className,
			classes.newsletterLabel,
		);
		assert.equal(
			view.host.querySelector("input").className,
			classes.newsletterField,
		);
		assert.equal(
			view.host.querySelector('button[type="submit"]').className,
			classes.newsletterSubmit,
		);
		(await expand(view.host)).requestSubmit();
		respond({ data: { success: true } });
		await flush();
		assert.equal(
			view.host.querySelector('[role="status"] > [tabindex="-1"]').className,
			classes.newsletterSuccess,
		);
	} finally {
		view.close();
	}
});

after(async () => {
	await window.happyDOM.abort();
});
