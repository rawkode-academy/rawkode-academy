// Replaces `shiki/wasm` (aliased in astro.config.mts). The site highlights
// with Shiki's JavaScript regex engine, so the Oniguruma WebAssembly blob
// (~620 KB) never ships in the Worker.
export default function unavailable(): never {
	throw new Error(
		"Shiki's Oniguruma engine is not bundled; use the JavaScript engine",
	);
}
