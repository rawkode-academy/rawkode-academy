import { createApp } from "vue";
import CommandPalette from "./CommandPalette.vue";

let mounted = false;
let returnFocus: HTMLElement | null = null;

/** The shared header imports this module only when search is requested. */
export function mountCommandPalette() {
	returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	if (mounted) {
		document.dispatchEvent(new CustomEvent("open-command-palette"));
		return;
	}
	const container = document.createElement("div");
	container.id = "command-palette-root";
	document.body.appendChild(container);
	createApp(CommandPalette, { returnFocus: () => returnFocus?.isConnected ? returnFocus : document.getElementById("topbar-search-trigger") }).mount(container);
	mounted = true;
}
