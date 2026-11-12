// Replaces `shiki/langs` (aliased in astro.config.mts) so the Worker bundle
// carries the grammars the content uses instead of all of Shiki's ~340.
// Keys are the language names and aliases code fences use (every language
// in the stored content, plus a few common ones; cpp alone would add 0.8 MB). Unknown languages
// render as plain text (Expressive Code logs a warning), as before.
type Loader = () => Promise<unknown>;

const bash: Loader = () => import("shiki/langs/bash.mjs");
const shellsession: Loader = () => import("shiki/langs/shellsession.mjs");
const yaml: Loader = () => import("shiki/langs/yaml.mjs");
const typescript: Loader = () => import("shiki/langs/typescript.mjs");
const javascript: Loader = () => import("shiki/langs/javascript.mjs");
const docker: Loader = () => import("shiki/langs/docker.mjs");
const hcl: Loader = () => import("shiki/langs/hcl.mjs");

export const bundledLanguages: Record<string, Loader> = {
	bash,
	sh: bash,
	shell: bash,
	zsh: bash,
	console: shellsession,
	shellsession,
	yaml,
	yml: yaml,
	rust: () => import("shiki/langs/rust.mjs"),
	rs: () => import("shiki/langs/rust.mjs"),
	nix: () => import("shiki/langs/nix.mjs"),
	typescript,
	ts: typescript,
	tsx: () => import("shiki/langs/tsx.mjs"),
	javascript,
	js: javascript,
	mjs: javascript,
	cjs: javascript,
	jsx: () => import("shiki/langs/jsx.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsonc: () => import("shiki/langs/jsonc.mjs"),
	toml: () => import("shiki/langs/toml.mjs"),
	docker,
	dockerfile: docker,
	containerfile: docker,
	graphql: () => import("shiki/langs/graphql.mjs"),
	gql: () => import("shiki/langs/graphql.mjs"),
	go: () => import("shiki/langs/go.mjs"),
	c: () => import("shiki/langs/c.mjs"),
	astro: () => import("shiki/langs/astro.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	py: () => import("shiki/langs/python.mjs"),
	hcl,
	terraform: () => import("shiki/langs/terraform.mjs"),
	tf: () => import("shiki/langs/terraform.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	ini: () => import("shiki/langs/ini.mjs"),
	// cue is registered from src/grammars/cue.tmLanguage.json in code.ts.
};
