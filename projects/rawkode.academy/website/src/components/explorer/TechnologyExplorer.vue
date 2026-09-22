<template>
 <div ref="explorerElement" class="technology-explorer">
 <!-- Header: View selector, Presets, Share -->
 <ExplorerHeader
 :view-mode="viewMode"
 :active-preset="activePreset"
 :filter-count="filterCount"
 :show-controls="showControls"
 @update:view-mode="setViewMode"
 @apply-preset="applyPreset"
 @toggle-controls="toggleControls"
 @share="handleShare"
 />

 <!-- Main content area -->
 <div class="explorer-main" :class="{ 'controls-collapsed': !showControls }">
 <!-- Closed desktop controls must leave both the layout and tab order. -->
 <aside
 v-if="!isMobile"
 v-show="showControls"
 class="explorer-controls"
 :inert="!showControls"
 aria-label="Advanced filters"
 @keydown.esc="closeDesktopControls"
 >
 <div class="controls-content">
 <!-- Axis selectors -->
 <div class="control-section">
 <h3 class="control-label">Axes</h3>
 <AxisSelector
 :id="`${controlsId}-x`"
 label="X-Axis (Columns)"
 :value="xAxis"
 @update:value="setXAxis"
 />
 <AxisSelector
 :id="`${controlsId}-y`"
 label="Y-Axis (Rows)"
 :value="yAxis"
 @update:value="setYAxis"
 />
 </div>

 <!-- Filters -->
 <FilterPanel
 :filters="filters"
 :available-values="availableFilterValues"
 @update:filter="setFilter"
 @update:search="setSearch"
 @clear="clearFilters"
 />
 </div>
 </aside>

 <!-- Body teleports must not hydrate: Vue reconciles them against the
 document body and strips the server-rendered page on mismatch. -->
 <Dialog.Root
 v-if="mounted"
 :open="isMobile && showControls"
 :modal="true"
 :trap-focus="true"
 :prevent-scroll="true"
 :close-on-escape="true"
 :close-on-interact-outside="true"
 :lazy-mount="true"
 :unmount-on-exit="true"
 :final-focus-el="getReturnFocus"
 @open-change="onDialogOpenChange"
 >
 <Teleport to="body">
 <Dialog.Backdrop class="controls-backdrop" />
 <Dialog.Positioner class="controls-positioner">
 <Dialog.Content class="controls-sheet">
 <div class="controls-content">
 <div
 class="controls-drawer-header"
 @touchstart.passive="onSheetTouchStart"
 @touchmove.passive="onSheetTouchMove"
 @touchend="onSheetTouchEnd"
 >
 <span class="drawer-handle" aria-hidden="true"></span>
 <Dialog.Title>Advanced filters</Dialog.Title>
 <Dialog.CloseTrigger class="controls-close" aria-label="Close advanced filters">
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
 </svg>
 </Dialog.CloseTrigger>
 </div>
 <Dialog.Description class="controls-description">Choose the matrix axes and filter technologies.</Dialog.Description>
 <div class="control-section">
 <h3 class="control-label">Axes</h3>
 <AxisSelector :id="`${controlsId}-x`" label="X-Axis (Columns)" :value="xAxis" @update:value="setXAxis" />
 <AxisSelector :id="`${controlsId}-y`" label="Y-Axis (Rows)" :value="yAxis" @update:value="setYAxis" />
 </div>
 <FilterPanel
 :filters="filters"
 :available-values="availableFilterValues"
 @update:filter="setFilter"
 @update:search="setSearch"
 @clear="clearFilters"
 />
 </div>
 </Dialog.Content>
 </Dialog.Positioner>
 </Teleport>
 </Dialog.Root>

 <!-- Visualization canvas -->
 <div
 class="explorer-canvas"
 role="region"
 aria-label="Technology matrix visualization"
 >
 <!-- Persistent search on mobile: the filter drawer is closed by default
 there, and search is the most common entry point. -->
 <div class="mobile-search">
 <input
 type="search"
 class="mobile-search-input"
 placeholder="Search technologies…"
 aria-label="Search technologies"
 :value="filters.search"
 @input="setSearch(($event.target as HTMLInputElement).value)"
 />
 <span class="mobile-search-count" aria-live="polite">{{ filteredTechnologies.length }} shown</span>
 </div>

 <!-- Grid View (Phase 1) -->
 <GridView
 v-if="viewMode === 'grid'"
 :technologies="filteredTechnologies"
 :grid-data="gridData"
 :x-axis="xAxis"
 :y-axis="yAxis"
 :x-axis-values="xAxisValues"
 :y-axis-values="yAxisValues"
 :hovered-tech-id="hoveredTechId"
 @hover="hoverTech"
 @select="selectTech"
 />

 <!-- Scatter View (Phase 2) -->
 <div v-else-if="viewMode === 'scatter'" class="coming-soon">
 <div class="coming-soon-icon">⊚</div>
 <h3>Scatter View</h3>
 <p>Coming in Phase 2</p>
 </div>

 <!-- Timeline View (Phase 2) -->
 <div v-else-if="viewMode === 'timeline'" class="coming-soon">
 <div class="coming-soon-icon">━</div>
 <h3>Timeline View</h3>
 <p>Coming in Phase 2</p>
 </div>

 <!-- Treemap View (Phase 3) -->
 <div v-else-if="viewMode === 'treemap'" class="coming-soon">
 <div class="coming-soon-icon">▤</div>
 <h3>Treemap View</h3>
 <p>Coming in Phase 3</p>
 </div>

 <!-- Sankey View (Phase 3) -->
 <div v-else-if="viewMode === 'sankey'" class="coming-soon">
 <div class="coming-soon-icon">⥤</div>
 <h3>Sankey Flow View</h3>
 <p>Coming in Phase 3</p>
 </div>
 </div>
 </div>

 <!-- Floating filter button (mobile): keeps filters reachable after
 scrolling a long results list. -->
 <button
 v-show="!showControls"
 type="button"
 class="filters-fab"
 aria-haspopup="dialog"
 :aria-expanded="showControls"
 @click="toggleControls($event)"
 >
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
 </svg>
 <span>Filters</span>
 <span v-if="filterCount > 0" class="fab-badge">{{ filterCount }}</span>
 </button>

 <!-- Technology card popover (click to show) -->
 <TechCardPopover
 v-if="selectedTech"
 :technology="selectedTech"
 @close="selectTech(null)"
 />

 <!-- Share toast notification -->
 <Transition name="toast">
 <div v-if="showShareToast" class="share-toast">
 <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
 </svg>
 <span>Link copied to clipboard!</span>
 </div>
 </Transition>
 </div>
</template>

<script setup lang="ts">
import { Dialog } from "@ark-ui/vue/dialog";
import {
	ref,
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	provide,
	useId,
} from "vue";
import type { NormalizedTechnology } from "@/lib/explorer/data-layer";
import { useExplorerState } from "@/composables/useExplorerState";
import { useUrlState } from "@/composables/useUrlState";
import { DIMENSIONS, type DimensionKey } from "@/lib/explorer/dimensions";
import ExplorerHeader from "./ExplorerHeader.vue";
import AxisSelector from "./controls/AxisSelector.vue";
import FilterPanel from "./controls/FilterPanel.vue";
import GridView from "./views/GridView.vue";
import TechCardPopover from "./cards/TechCardPopover.vue";

interface Props {
	technologies: NormalizedTechnology[];
}

const props = defineProps<Props>();

// Initialize explorer state
const explorer = useExplorerState(props.technologies);

// Destructure for template
const {
	viewMode,
	xAxis,
	yAxis,
	filters,
	hoveredTechId,
	showControls,
	filteredTechnologies,
	gridData,
	xAxisValues,
	yAxisValues,
	activePreset,
	filterCount,
	selectedTech,
	setViewMode,
	setXAxis,
	setYAxis,
	setFilter,
	setSearch,
	clearFilters,
	applyPreset,
	hoverTech,
	selectTech,
} = explorer;

const explorerElement = ref<HTMLElement | null>(null);
const controlsId = useId();
const isMobile = ref(false);
const mounted = ref(false);
let viewport: MediaQueryList | undefined;
let desktopControlsOpen = showControls.value;
let returnFocus: HTMLElement | null = null;

const getHeaderToggle = () =>
	explorerElement.value?.querySelector<HTMLButtonElement>(".controls-toggle") ??
	null;

const getReturnFocus = () =>
	returnFocus?.isConnected &&
	(isMobile.value || !returnFocus.classList.contains("filters-fab"))
		? returnFocus
		: getHeaderToggle();

function toggleControls(event?: MouseEvent) {
	if (!showControls.value) {
		returnFocus =
			event?.currentTarget instanceof HTMLElement
				? event.currentTarget
				: getHeaderToggle();
	}
	explorer.toggleControls();
}

const closeControls = () => {
	showControls.value = false;
};

function closeDesktopControls(event: KeyboardEvent) {
	if (event.defaultPrevented) return;
	event.preventDefault();
	event.stopPropagation();
	closeControls();
	getHeaderToggle()?.focus();
}

function onDialogOpenChange(details: { open: boolean }) {
	if (isMobile.value) showControls.value = details.open;
}

async function updateViewport() {
	const mobile = viewport?.matches ?? false;
	if (mobile === isMobile.value) return;
	const restoreFocus =
		(isMobile.value && showControls.value) ||
		Boolean(
			explorerElement.value
				?.querySelector(".explorer-controls")
				?.contains(document.activeElement),
		);
	if (mobile) desktopControlsOpen = showControls.value;
	// Closing the dialog releases Ark's modal effects, including its scroll lock.
	// Keep filter state untouched and never turn a desktop sidebar into an open modal.
	showControls.value = mobile ? false : desktopControlsOpen;
	isMobile.value = mobile;
	sheetTouchY = null;
	sheetTouchDelta = 0;
	if (restoreFocus) {
		await nextTick();
		getHeaderToggle()?.focus();
	}
}

// Swipe-down on the sheet header dismisses it.
let sheetTouchY: number | null = null;
let sheetTouchDelta = 0;

function onSheetTouchStart(event: TouchEvent) {
	sheetTouchY = event.touches[0]?.clientY ?? null;
	sheetTouchDelta = 0;
}

function onSheetTouchMove(event: TouchEvent) {
	if (sheetTouchY === null) return;
	sheetTouchDelta = (event.touches[0]?.clientY ?? sheetTouchY) - sheetTouchY;
}

function onSheetTouchEnd() {
	if (sheetTouchDelta > 60 && isMobile.value) {
		closeControls();
	}
	sheetTouchY = null;
	sheetTouchDelta = 0;
}

// URL state sync
const urlState = useUrlState(explorer);

// Share functionality
const showShareToast = ref(false);

const handleShare = async () => {
	const success = await urlState.copyShareUrl();
	if (success) {
		showShareToast.value = true;
		setTimeout(() => {
			showShareToast.value = false;
		}, 2500);
	}
};

// Compute available filter values from data (respecting dimension order)
const availableFilterValues = computed(() => {
	const values: Record<DimensionKey, string[]> = {} as Record<
		DimensionKey,
		string[]
	>;

	for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
		const uniqueValues = new Set<string>();
		for (const tech of props.technologies) {
			const value = tech.dimensions[key];
			if (value !== null) {
				uniqueValues.add(value);
			}
		}

		// Use dimension's predefined order if available, otherwise sort alphabetically
		const dimDef = DIMENSIONS[key];
		if (dimDef.values.length > 0) {
			// Filter to only values that exist in data, maintaining predefined order
			values[key] = dimDef.values
				.map((v) => v.value)
				.filter((v) => uniqueValues.has(v));
		} else {
			values[key] = [...uniqueValues].sort();
		}
	}

	return values;
});

// Provide explorer state to child components
provide("explorer", explorer);

// Initialize from URL on mount
onMounted(() => {
	mounted.value = true;
	urlState.initFromUrl();
	viewport = window.matchMedia("(max-width: 768px)");
	updateViewport();
	viewport.addEventListener("change", updateViewport);
});

onBeforeUnmount(() => {
	viewport?.removeEventListener("change", updateViewport);
});
</script>

<style scoped>
.technology-explorer {
 display: flex;
 flex-direction: column;
 min-height: calc(100vh - 220px);
}

.explorer-main {
 display: flex;
 flex: 1;
 gap: 1.5rem;
 position: relative;
}

.explorer-controls {
 width: 280px;
 flex-shrink: 0;
}

.controls-content {
 display: flex;
 flex-direction: column;
 gap: 1.5rem;
 padding: 1rem;
 background: var(--colors-academy-panel);
 border: 1px solid var(--colors-academy-border);
 border-radius: 8px;
 position: sticky;
 top: 1rem;
 overflow: visible;
}

.controls-drawer-header {
 display: none;
}

.controls-description {
 margin: 0;
 color: var(--colors-academy-text-soft);
 font-size: 0.875rem;
}

.control-section {
 display: flex;
 flex-direction: column;
 gap: 0.75rem;
}

.control-label {
 font-size: 0.7rem;
 font-weight: 700;
 letter-spacing: 0.05em;
 color: var(--colors-academy-text-muted);
 margin: 0;
}

.explorer-canvas {
 flex: 1;
 min-width: 0;
}

/* Mobile-only affordances, hidden on desktop */
.mobile-search,
.filters-fab,
.drawer-handle {
 display: none;
}

/* Coming soon placeholder */
.coming-soon {
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: center;
 min-height: 400px;
 padding: 3rem;
 background: var(--colors-academy-panel);
 border: 2px dashed var(--colors-academy-border);
 border-radius: 8px;
 text-align: center;
}

.coming-soon-icon {
 font-size: 4rem;
 margin-bottom: 1rem;
 opacity: 0.3;
}

.coming-soon h3 {
 font-size: 1.5rem;
 font-weight: 700;
 margin: 0 0 0.5rem;
 color: var(--colors-academy-text);
}

.coming-soon p {
 font-size: 1rem;
 color: var(--colors-academy-text-muted);
 margin: 0;
}

/* Share toast */
.share-toast {
 position: fixed;
 bottom: 2rem;
 left: 50%;
 transform: translateX(-50%);
 display: flex;
 align-items: center;
 gap: 0.5rem;
 padding: 0.75rem 1.25rem;
 background: var(--colors-academy-text);
 color: var(--colors-academy-canvas);
 border-radius: 6px;
 font-size: 0.875rem;
 font-weight: 600;
 box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
 z-index: 100;
}

.toast-icon {
 width: 18px;
 height: 18px;
}

.toast-enter-active,
.toast-leave-active {
 transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
 opacity: 0;
 transform: translateX(-50%) translateY(1rem);
}

/* Mobile responsive */
@media (max-width: 768px) {
 .explorer-main {
 flex-direction: column;
 }

 .controls-backdrop {
 position: fixed;
 inset: 0;
 z-index: 49;
 display: block;
 background: color-mix(in oklab, var(--colors-academy-text) 42%, transparent);
 border: 0;
 cursor: pointer;
 }

 .controls-positioner {
 position: fixed;
 inset: 0;
 z-index: 50;
 display: flex;
 align-items: flex-end;
 pointer-events: none;
 }

 .controls-sheet {
 width: 100%;
 pointer-events: auto;
 position: relative;
 bottom: 0;
 max-height: min(82vh, 680px);
 overflow-y: auto;
 overscroll-behavior: contain;
 border-radius: 8px 8px 0 0;
 box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
 }

 .controls-content {
 position: static;
 border-radius: 8px 8px 0 0;
 padding-top: 0;
 }

 .controls-drawer-header {
 position: sticky;
 top: 0;
 z-index: 1;
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 1rem;
 margin: 0 -1rem;
 padding: 0.875rem 1rem;
 background: var(--colors-academy-panel);
 border-bottom: 1px solid var(--colors-academy-border);
 }

 .controls-drawer-header h2 {
 margin: 0;
 font-size: 0.82rem;
 font-weight: 800;
 letter-spacing: 0.08em;
 color: var(--colors-academy-text);
 }

 .controls-close {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 width: 2.5rem;
 height: 2.5rem;
 background: var(--colors-academy-ground);
 border: 1px solid var(--colors-academy-border);
 border-radius: 6px;
 color: var(--colors-academy-text);
 cursor: pointer;
 }

 .controls-close svg {
 width: 1.15rem;
 height: 1.15rem;
 }

 .explorer-canvas {
 padding-bottom: 80px; /* Space for the floating filter button */
 }

 .mobile-search {
 display: flex;
 align-items: center;
 gap: 0.625rem;
 margin-bottom: 0.875rem;
 }

 .mobile-search-input {
 flex: 1;
 min-width: 0;
 min-height: 44px;
 padding: 0.5rem 0.875rem;
 background: var(--colors-academy-panel);
 border: 1px solid var(--colors-academy-border);
 border-radius: 6px;
 font-size: 1rem;
 color: var(--colors-academy-text);
 }

 .mobile-search-input:focus-visible {
 outline: 2px solid var(--colors-academy-accent);
 outline-offset: 1px;
 }

 .mobile-search-count {
 font-family: var(--fonts-academy-mono), monospace;
 font-size: 0.72rem;
 font-weight: 700;
 color: var(--colors-academy-text-muted);
 white-space: nowrap;
 }

 .filters-fab {
 position: fixed;
 bottom: 1.25rem;
 right: 1.25rem;
 z-index: 48; /* below the sheet (50) and its backdrop (49) */
 display: inline-flex;
 align-items: center;
 gap: 0.5rem;
 min-height: 48px;
 padding: 0.75rem 1.125rem;
 background: var(--colors-academy-text);
 color: var(--colors-academy-canvas);
 border: 1px solid var(--colors-academy-text);
 border-radius: 9999px;
 font-family: var(--fonts-academy-mono), monospace;
 font-size: 0.72rem;
 font-weight: 700;
 letter-spacing: 0.1em;
 cursor: pointer;
 box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
 }

 .filters-fab svg {
 width: 1rem;
 height: 1rem;
 }

 .fab-badge {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 min-width: 1.25rem;
 height: 1.25rem;
 padding: 0 0.3rem;
 background: var(--colors-academy-accent);
 color: var(--colors-academy-accent-foreground);
 border-radius: 9999px;
 font-size: 0.65rem;
 }

 .drawer-handle {
 display: block;
 position: absolute;
 top: 0.375rem;
 left: 50%;
 transform: translateX(-50%);
 width: 2.5rem;
 height: 0.25rem;
 border-radius: 9999px;
 background: var(--surface-border-strong, var(--colors-academy-border));
 }
}
</style>
