<script setup lang="ts">
import { Combobox, createListCollection } from "@ark-ui/vue/combobox";
import { Dialog } from "@ark-ui/vue/dialog";
import { academyCommand, academyLayout, dialog } from "@rawkodeacademy/design-system";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getColorSchemePreference, setColorScheme, type ColorSchemePreference } from "@/lib/theme";

interface Item {
	id: string;
	title: string;
	description?: string;
	href?: string;
	category: string;
	keywords?: string[];
	preference?: ColorSchemePreference;
}
interface SearchResult extends Omit<Item, "category"> { type: string }
const props = defineProps<{ returnFocus: () => HTMLElement | null }>();
function trackEvent(event: string, properties?: Record<string, unknown>) {
	try { window.posthog?.capture(event, properties); } catch { /* Analytics must not interrupt navigation. */ }
}
const s = academyCommand();
const layout = academyLayout();
const modal = dialog({ tone: "academy" });
let returnFocus = props.returnFocus();
const open = ref(true);
const query = ref("");
const appearance = ref(false);
const navigation = ref<Item[]>([]);
const results = ref<Item[]>([]);
const navigationLoaded = ref(false);
const loadingNavigation = ref(false);
const searching = ref(false);
const navigationError = ref(false);
const searchError = ref(false);
const preference = ref<ColorSchemePreference>("system");
const inputContainer = ref<HTMLElement | null>(null);
const categoryFor: Record<string, string> = { video: "Videos", article: "Articles", news: "News", course: "Learning", "learning-path": "Learning", show: "Shows", technology: "Technology" };
const appearanceItems: Item[] = [
	{ id: "back", title: "Back to commands", category: "Commands" },
	{ id: "light", title: "Light mode", description: "Always use the light theme", category: "Appearance", preference: "light" },
	{ id: "dark", title: "Dark mode", description: "Always use the dark theme", category: "Appearance", preference: "dark" },
	{ id: "system", title: "System theme", description: "Follow your operating system preference", category: "Appearance", preference: "system" },
];
const items = computed(() => {
	const remoteHrefs = new Set(results.value.map(item => item.href));
	const candidates: Item[] = appearance.value ? appearanceItems : [
		{ id: "appearance", title: "Change appearance", description: "Choose light, dark, or system theme", category: "Commands", keywords: ["theme", "mode"] },
		...navigation.value.filter(item => !remoteHrefs.has(item.href)),
	];
	const terms = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
	const local = candidates.filter(item => terms.every(term => `${item.title} ${item.description ?? ""} ${item.keywords?.join(" ") ?? ""}`.toLowerCase().includes(term)));
	// The server ranks content matches. Do not filter those a second time by title.
	return appearance.value ? local : [...local, ...results.value];
});
const groups = computed(() => [...new Set(items.value.map(item => item.category))].map(category => ({ category, items: items.value.filter(item => item.category === category) })));
const collection = computed(() => createListCollection({ items: items.value, itemToString: item => item.title, itemToValue: item => item.id }));

watch(open, async (isOpen, _previous, onCleanup) => {
	if (!isOpen) { query.value = ""; appearance.value = false; return; }
	trackEvent("command_palette_opened");
	preference.value = getColorSchemePreference();
	if (navigationLoaded.value) return;
	const controller = new AbortController();
	onCleanup(() => controller.abort());
	loadingNavigation.value = true;
	navigationError.value = false;
	try {
		const response = await fetch("/api/sitemap-pages.json", { signal: controller.signal });
		if (!response.ok) throw new Error("Navigation unavailable");
		const data: Item[] = await response.json();
		if (controller.signal.aborted) return;
		navigation.value = data.filter(item => item.category !== "Articles").map(item => ({ ...item, id: `page:${item.id}` }));
		navigationLoaded.value = true;
	} catch { if (!controller.signal.aborted) navigationError.value = true; }
	finally { if (!controller.signal.aborted) loadingNavigation.value = false; }
}, { immediate: true });

watch([query, appearance, open], ([value, isAppearance, isOpen], _old, onCleanup) => {
	results.value = [];
	searching.value = false;
	searchError.value = false;
	if (!isOpen || isAppearance || value.trim().length < 2) return;
	const controller = new AbortController();
	searching.value = true;
	const timer = setTimeout(async () => {
		try {
			const response = await fetch(`/api/search.json?q=${encodeURIComponent(value)}`, { signal: controller.signal });
			if (!response.ok) throw new Error("Search unavailable");
			const data: SearchResult[] = await response.json();
			if (controller.signal.aborted) return;
			results.value = data.map(item => ({ ...item, id: `result:${item.type}:${item.id}`, category: categoryFor[item.type] ?? "Pages" }));
		} catch { if (!controller.signal.aborted) searchError.value = true; }
		finally { if (!controller.signal.aborted) searching.value = false; }
	}, 300);
	onCleanup(() => { clearTimeout(timer); controller.abort(); });
});

function selectItem(id: string | undefined) {
	const item = items.value.find(item => item.id === id);
	if (!item) return;
	if (id === "appearance" || id === "back") { appearance.value = id === "appearance"; query.value = ""; return; }
	if (item.preference) {
		const previous = preference.value;
		setColorScheme(item.preference); preference.value = item.preference;
		trackEvent("color_scheme_switched", { from_preference: previous, to_preference: item.preference, source: "command_palette" });
	}
	else if (item.href) {
		trackEvent("command_palette_navigation", { item_id: item.id, item_title: item.title, category: item.category });
		const url = new URL(item.href, window.location.origin);
		if (!["http:", "https:"].includes(url.protocol)) return;
		if (url.origin === window.location.origin) window.location.assign(url.href);
		else window.open(url.href, "_blank", "noopener,noreferrer");
	}
	open.value = false;
}
function openPalette() {
	if (!open.value && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
	open.value = true;
}
function onKeydown(event: KeyboardEvent) {
	if ((event.metaKey || event.ctrlKey) && ["k", "/"].includes(event.key.toLowerCase())) {
		event.preventDefault();
		if (open.value) open.value = false; else openPalette();
	}
}
onMounted(() => { document.addEventListener("open-command-palette", openPalette); document.addEventListener("keydown", onKeydown); });
onUnmounted(() => { document.removeEventListener("open-command-palette", openPalette); document.removeEventListener("keydown", onKeydown); });
</script>

<template>
	<Dialog.Root v-model:open="open" :initial-focus-el="() => inputContainer?.querySelector('input') ?? null" :final-focus-el="() => returnFocus?.isConnected ? returnFocus : props.returnFocus()" :trap-focus="true" :prevent-scroll="true">
		<Teleport to="body">
			<Dialog.Backdrop :class="modal.backdrop" />
			<Dialog.Positioner :class="s.positioner">
				<Dialog.Content :class="s.content">
					<div :class="s.header">
						<Dialog.Title :class="s.title">{{ appearance ? 'Appearance' : 'Search and commands' }}</Dialog.Title>
						<Dialog.CloseTrigger :class="layout.buttonSecondary">Close</Dialog.CloseTrigger>
					</div>
					<div ref="inputContainer">
						<Combobox.Root :collection="collection" :open="true" :input-value="query" :model-value="[]" :loop-focus="true" :close-on-select="false" selection-behavior="preserve" @input-value-change="query = $event.inputValue" @value-change="selectItem($event.value[0])">
							<Combobox.Control>
								<Combobox.Input :class="s.input" aria-label="Search content and commands" placeholder="Search the Academy…" @keydown.esc.prevent="open = false" @keydown.backspace="!query && (appearance = false)" />
							</Combobox.Control>
							<Combobox.Content :class="s.list">
								<Combobox.ItemGroup v-for="group in groups" :key="group.category">
									<Combobox.ItemGroupLabel :class="s.group">{{ group.category }}</Combobox.ItemGroupLabel>
									<Combobox.Item v-for="item in group.items" :key="item.id" :item="item" :class="s.item">
										<Combobox.ItemText :class="s.label">{{ item.title }}{{ item.preference === preference ? ' (current)' : '' }}</Combobox.ItemText>
										<span v-if="item.description" :class="s.description">{{ item.description }}</span>
									</Combobox.Item>
								</Combobox.ItemGroup>
							</Combobox.Content>
						</Combobox.Root>
					</div>
					<p v-if="loadingNavigation || searching" :class="s.status" role="status">{{ searching ? 'Searching content…' : 'Loading navigation…' }}</p>
					<p v-else-if="!items.length" :class="s.status" role="status">No results. Try another search.</p>
					<p v-if="navigationError || searchError" :class="s.status" role="alert">{{ searchError ? 'Content search is unavailable.' : 'Navigation could not be loaded.' }} <a href="/search">Open the search page</a>.</p>
					<Dialog.Description :class="s.footer">Use arrow keys to browse, Enter to select, and Escape to close.</Dialog.Description>
				</Dialog.Content>
			</Dialog.Positioner>
		</Teleport>
	</Dialog.Root>
</template>
