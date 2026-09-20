// Source guard. Run with Node 24+ after installing workspace dependencies.
import assert from "node:assert/strict";
import { getRecipeUsage } from "./academy-source.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const website = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(website, "../../..");
const designSystem = resolve(repository, "packages/design-system");
const read = (path) => readFileSync(resolve(website, path), "utf8");
const walk = (directory, extensions) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		return entry.isDirectory()
			? walk(path, extensions)
			: extensions.has(extname(entry.name))
				? [path]
				: [];
	});
const local = (path) => relative(website, path).replaceAll("\\", "/");

const pageWrapper = /@\/wrappers\/page\.astro/;
const showLayout = /@\/layouts\/ShowLayout\.astro/;
const exceptions = new Map([
	[
		"src/pages/embed/webcontainer.astro",
		["isolated workbench", "academyMedia"],
	],
]);
const routes = walk(resolve(website, "src/pages"), new Set([".astro", ".mdx"]))
	.map(local)
	.sort();
for (const route of routes) {
	const source = read(route);
	const exception = exceptions.get(route);
	if (exception) {
		assert.match(
			source,
			/@\/layouts\/minimal\.astro/,
			`${route}: missing MinimalLayout`,
		);
		assert.match(
			source,
			new RegExp(`\\b${exception[1]}\\b`),
			`${route}: missing Panda recipe`,
		);
		continue;
	}
	assert.doesNotMatch(
		source,
		/<(?:html|body)\b/i,
		`${route}: bypasses the canonical document`,
	);
	assert.ok(
		pageWrapper.test(source) || showLayout.test(source),
		`${route}: no canonical Panda shell path`,
	);
}
for (const route of exceptions.keys()) {
	assert.ok(routes.includes(route), `stale minimal-layout exception: ${route}`);
}

assert.match(read("src/wrappers/page.astro"), /@\/layouts\/app\.astro/);
assert.match(
	read("src/wrappers/page.astro"),
	/@rawkodeacademy\/design-system\/styles\.css/,
);
assert.match(read("src/layouts/ShowLayout.astro"), pageWrapper);
const shell = read("src/layouts/app.astro");
assert.match(shell, /data-ui-shell="panda-v2"/);
assert.equal((shell.match(/<main\b/g) ?? []).length, 1);
assert.match(shell, /id="main-content"[^>]*tabindex="-1"/);

const bracketPages = walk(
	resolve(website, "src/lib/shows/plugins/bracket/pages"),
	new Set([".astro"]),
).sort();
const bracketNames = bracketPages.map(
	(path) => path.match(/\/([^/]+)\.astro$/)?.[1],
);
assert.deepEqual(bracketNames, ["Apply", "Brackets", "Schedule", "Seasons"]);
const bracketPlugin = read("src/lib/shows/plugins/bracket/index.ts");
for (const [index, name] of bracketNames.entries()) {
	const slug = ["apply", "brackets", "schedule", "seasons"][index];
	assert.match(
		bracketPlugin,
		new RegExp(`import ${name} from "\\./pages/${name}\\.astro"`),
	);
	assert.match(
		bracketPlugin,
		new RegExp(
			`\\b${slug}:\\s*\\{[\\s\\S]*?slug:\\s*"${slug}"[\\s\\S]*?Component:\\s*${name}`,
		),
	);
	const source = read(local(bracketPages[index]));
	assert.doesNotMatch(source, /<(?:html|body)\b/i);
}
const dynamicShowRoute = read("src/pages/shows/[showId]/[...slug].astro");
assert.match(dynamicShowRoute, showLayout);
assert.match(read("src/layouts/ShowLayout.astro"), /showLayoutStyles/);
assert.match(read("src/layouts/showStyles.ts"), /academyLayout/);

const exportedNames = (source) =>
	new Set(
		[...source.matchAll(/export\s*{([^}]+)}/gs)].flatMap((match) =>
			match[1]
				.split(",")
				.map((item) => {
					const names = item
						.trim()
						.replace(/^type\s+/, "")
						.split(/\s+as\s+/);
					return (names[1] ?? names[0]).trim();
				})
				.filter(Boolean),
		),
	);
const publicExports = exportedNames(
	readFileSync(resolve(designSystem, "src/index.ts"), "utf8"),
);
const vueExports = exportedNames(
	readFileSync(resolve(designSystem, "src/vue/index.ts"), "utf8"),
);
const recipes = new Map();
for (const path of walk(
	resolve(designSystem, "src/recipes"),
	new Set([".ts"]),
)) {
	const source = readFileSync(path, "utf8");
	const name = source.match(/export const\s+(\w+)\s*=\s*sva\s*\(/)?.[1];
	if (!name) continue;
	const slots = source.match(/["']?slots["']?:\s*\[([\s\S]*?)\]/)?.[1];
	assert.ok(slots, `${name}: missing slots`);
	recipes.set(
		name,
		new Set([...slots.matchAll(/["'](\w+)["']/g)].map((match) => match[1])),
	);
}

const sourceFiles = walk(
	resolve(website, "src"),
	new Set([".astro", ".mdx", ".ts", ".tsx", ".vue"]),
);
for (const path of sourceFiles) {
	const source = readFileSync(path, "utf8");
	if (!source.includes("@rawkodeacademy/design-system")) continue;
	let usage;
	try {
		usage = await getRecipeUsage(source, extname(path));
	} catch (error) {
		throw new Error(`${local(path)}: could not analyze recipe usage`, {
			cause: error,
		});
	}
	for (const { module, imported } of usage.imports) {
		const exports = module.endsWith("/vue") ? vueExports : publicExports;
		assert.ok(
			exports.has(imported),
			`${local(path)}: missing export ${module}.${imported}`,
		);
	}
	for (const { imported, slot } of usage.accesses) {
		if (!recipes.has(imported)) continue;
		assert.ok(
			recipes.get(imported).has(slot),
			`${local(path)}: missing ${imported}.${slot} slot`,
		);
	}
}

const packageJson = JSON.parse(read("package.json"));
const lock = JSON.parse(
	readFileSync(resolve(repository, "bun.lock"), "utf8")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/,\s*([}\]])/g, "$1"),
);
const lockWorkspace = lock.workspaces["projects/rawkode.academy/website"];
for (const group of ["dependencies", "devDependencies"]) {
	assert.deepEqual(
		lockWorkspace[group],
		packageJson[group],
		`${group}: package.json and bun.lock differ`,
	);
}

assert.match(read("src/pages/watch/index.astro"), /VideoItemListJsonLd/);
assert.match(
	read("src/pages/learning-paths/index.astro"),
	/LearningPathItemListJsonLd/,
);
assert.match(read("src/pages/index.astro"), /rel="preload"/);
assert.doesNotMatch(
	read("src/components/academy/AcademyPage.vue"),
	/<header|<footer|toggleTheme/,
);
assert.match(
	read("src/components/branding/AcademyBrand.astro"),
	/wordmark\.svg\?raw/,
);
const videoReactions = read("src/components/video/VideoReactionsClient.vue");
assert.doesNotMatch(
	videoReactions,
	/<Teleport\b/,
	"reaction picker must stay inside its deferred island",
);
assert.match(videoReactions, /v-model:open="pickerOpen"/);
assert.match(videoReactions, /:lazy-mount="true"/);
assert.match(videoReactions, /:unmount-on-exit="true"/);
assert.match(videoReactions, /:portalled="false"/);

const watchVisibleSources = [
	"src/pages/watch/[...slug].astro",
	"src/components/video/LiveStreamGate.vue",
	"src/components/video/CloudflareWhepPlayer.vue",
	"src/components/video/player.vue",
	"src/components/video/StreamNotifyButton.vue",
	"src/components/video/VideoReactions.astro",
	"src/components/video/VideoReactionsClient.vue",
	"src/components/video/video-content-tabs.vue",
	"src/components/video/comments.vue",
	"src/components/video/VideoTranscript.astro",
	"src/components/video/VideoCast.astro",
	"src/components/video/ShowVideoSection.astro",
	"src/components/video/TechnologyVideoSection.astro",
	"src/components/newsletter/NewsletterCTA.astro",
	"src/components/newsletter/NewsletterWidget.vue",
	"src/components/auth/sign-in-button.astro",
	"src/components/auth/profile.vue",
	"src/components/ui/MLabel.vue",
	"src/components/ui/LiveDot.vue",
	"src/components/ui/EmptyState.vue",
	"src/components/common/ErrorState.vue",
	"src/components/common/SkeletonComment.vue",
	"src/components/common/SkeletonText.vue",
	"src/components/common/SkeletonTranscript.vue",
];
const legacyWatchAliases =
	/--(?:editorial|surface|brand)-|\b(?:paper-card|paper-panel|section-shell|text-(?:primary-content|secondary-content|muted)|border-surface|focus-ring|bleed-x-mobile)\b/;
const directBrandRgb = /rgb\(var\(--brand-/;
const directPaletteUtility =
	/\b(?:bg|text|border|ring|outline|fill|stroke)-(?:primary|secondary|accent|white|black|neutral|red|yellow|orange|amber|green|emerald|blue|indigo|violet|purple|pink|rose)-[\w/[\].-]+/;
const directPaletteLiteral = /(?:#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)\()/i;
for (const path of watchVisibleSources) {
	const source = read(path);
	assert.doesNotMatch(
		source,
		legacyWatchAliases,
		`${path}: legacy watch palette alias`,
	);
	assert.doesNotMatch(
		source,
		directBrandRgb,
		`${path}: direct legacy brand RGB`,
	);
	assert.doesNotMatch(
		source,
		directPaletteUtility,
		`${path}: direct palette utility`,
	);
	assert.doesNotMatch(
		source,
		directPaletteLiteral,
		`${path}: direct palette literal`,
	);
}
const watchRoute = read("src/pages/watch/[...slug].astro");
assert.match(watchRoute, /academyWatch/);
assert.doesNotMatch(
	watchRoute,
	/<style\b/i,
	"watch route must use Panda recipe slots",
);
assert.match(watchRoute, /const isLiveNow = isLive && studioLiveState\.live/);
assert.match(
	watchRoute,
	/const watchStatusLabel = isLiveNow[\s\S]*?"Live now"[\s\S]*?"Upcoming"[\s\S]*?null/,
);
assert.match(watchRoute, /<MLabel tone=\{isLiveNow \? "amber" : "accent"\}>/);
assert.match(watchRoute, /\{isLiveNow && <LiveDot color="amber" \/>\}/);
assert.match(watchRoute, /data-academy-learn-list/);
assert.match(watchRoute, /data-academy-prose/);
const globalStyles = read("src/styles/global.css");
assert.match(
	globalStyles,
	/\[data-academy-prose\][\s\S]*?list-style-type: disc/,
);
assert.match(
	globalStyles,
	/\[data-academy-learn-list\][\s\S]*?list-style-type: decimal/,
);
const cloudflareWhepPlayer = read(
	"src/components/video/CloudflareWhepPlayer.vue",
);
assert.match(cloudflareWhepPlayer, /academyWatch/);
assert.doesNotMatch(
	cloudflareWhepPlayer,
	/<style\b/i,
	"live player must use Panda recipe slots",
);
const reactionsClient = read("src/components/video/VideoReactionsClient.vue");
assert.match(
	reactionsClient,
	/academyWatch\(\{ pressed: Boolean\(pressed\[emoji\]\) \}\)\.reactionButton/,
);
assert.doesNotMatch(reactionsClient, /reactionButtonActive/);
const drawer = readFileSync(
	resolve(designSystem, "src/vue/NavigationDrawer.vue"),
	"utf8",
);
for (const behavior of [
	"trap-focus",
	"prevent-scroll",
	"close-on-escape",
	"close-on-interact-outside",
]) {
	assert.ok(drawer.includes(`:${behavior}="true"`));
}
assert.match(drawer, /href="#academy-footer-navigation"/);

// Completed migration boundaries must stay on shared recipes and Ark controls.
const migratedViews = [
	"src/pages/home.astro",
	"src/pages/settings/index.astro",
	"src/pages/resources/kubernetes/1.35-cheatsheet.astro",
	"src/components/settings/EmailPreferences.vue",
	"src/components/settings/PreferenceSwitch.vue",
	"src/components/settings/TestEmailButton.vue",
	"src/components/courses/ResourceList.vue",
	"src/components/courses/EmbeddedAppModal.vue",
	"src/components/courses/WebContainerEmbed.vue",
	"src/components/lead-magnet/K8sCheatsheetCTA.vue",
	"src/components/command-palette/CommandPalette.vue",
];
for (const path of migratedViews) {
	assert.match(
		read(path),
		/@rawkodeacademy\/design-system/,
		`${path}: missing shared recipe`,
	);
	assert.doesNotMatch(
		read(path),
		/--(?:editorial|surface|brand|terminal)-/,
		`${path}: legacy palette alias`,
	);
}
const commandPalette = read(
	"src/components/command-palette/CommandPalette.vue",
);
assert.match(commandPalette, /@ark-ui\/vue\/combobox/);
assert.match(commandPalette, /@ark-ui\/vue\/dialog/);
assert.doesNotMatch(
	read("src/components/command-palette/mount.ts"),
	/react|cmdk/,
);
assert.doesNotMatch(
	read("src/components/courses/WebContainerEmbed.vue"),
	/v-html/,
);

// Exercise the real typed theme utility with blocked browser persistence.
const attributes = new Map();
let dark = false;
let stored = null;
let blocked = true;
globalThis.localStorage = {
	getItem() {
		if (blocked) throw new Error("Storage denied");
		return stored;
	},
	setItem(_key, value) {
		if (blocked) throw new Error("Storage denied");
		stored = value;
	},
};
globalThis.document = {
	documentElement: {
		getAttribute: (key) => attributes.get(key) ?? null,
		setAttribute: (key, value) => attributes.set(key, value),
		classList: {
			toggle: (_key, value) => {
				dark = value;
			},
			contains: () => dark,
		},
	},
	querySelector: () => null,
};
globalThis.window = {
	dispatchEvent: () => true,
	matchMedia: () => ({ matches: false }),
};
const theme = await import(new URL("../src/lib/theme.ts", import.meta.url));
assert.equal(theme.getColorSchemePreference(), "system");
theme.setColorScheme("dark");
assert.equal(dark, true);
assert.equal(theme.getColorSchemePreference(), "dark");
assert.equal(theme.toggleColorScheme(), "system");
assert.equal(dark, false);
assert.equal(theme.toggleColorScheme(), "light");
blocked = false;
theme.setColorScheme("dark");
assert.equal(stored, "dark");
assert.equal(theme.getColorScheme(), "dark");

console.log(
	`Validated ${routes.length} visual routes, including ${exceptions.size} explicit minimal exceptions.`,
);
console.log(
	`Validated ${bracketPages.length} dynamic bracket pages and ${recipes.size} design-system recipes.`,
);
console.log(
	"Canonical Panda shell, recipe slots, exports, and lock consistency passed.",
);
