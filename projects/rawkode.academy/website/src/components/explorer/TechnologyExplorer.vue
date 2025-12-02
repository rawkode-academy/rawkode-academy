<template>
  <div class="technology-explorer">
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
      <!-- Controls sidebar (collapsible on mobile) -->
      <aside
        class="explorer-controls"
        :class="{ 'is-open': showControls }"
        :aria-hidden="!showControls"
      >
        <div class="controls-content">
          <!-- Axis selectors -->
          <div class="control-section">
            <h3 class="control-label">Axes</h3>
            <AxisSelector
              label="X-Axis (Columns)"
              :value="xAxis"
              @update:value="setXAxis"
            />
            <AxisSelector
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

      <!-- Visualization canvas -->
      <main class="explorer-canvas">
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
      </main>
    </div>

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
import { ref, computed, onMounted, provide } from "vue";
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
	sizeBy,
	colorBy,
	filters,
	hoveredTechId,
	selectedTechId,
	showControls,
	filteredTechnologies,
	gridData,
	xAxisValues,
	yAxisValues,
	activePreset,
	filterCount,
	hoveredTech,
	selectedTech,
	setViewMode,
	setXAxis,
	setYAxis,
	setSizeBy,
	setColorBy,
	setFilter,
	setSearch,
	clearFilters,
	applyPreset,
	hoverTech,
	selectTech,
	toggleControls,
} = explorer;

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
	urlState.initFromUrl();
});
</script>

<style scoped>
.technology-explorer {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 200px);
}

.explorer-main {
  display: flex;
  flex: 1;
  gap: 1.5rem;
}

.explorer-controls {
  width: 280px;
  flex-shrink: 0;
  transition: width 0.3s ease, opacity 0.3s ease;
}

.explorer-controls:not(.is-open) {
  width: 0;
  opacity: 0;
  overflow: hidden;
}

.controls-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  position: sticky;
  top: 1rem;
  overflow: visible;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0;
}

.explorer-canvas {
  flex: 1;
  min-width: 0;
}

/* Coming soon placeholder */
.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 3rem;
  background: var(--surface-card);
  border: 2px dashed var(--surface-border);
  border-radius: 16px;
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
  color: var(--text-primary-content);
}

.coming-soon p {
  font-size: 1rem;
  color: var(--text-muted);
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
  background: rgb(var(--brand-primary));
  color: white;
  border-radius: 9999px;
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

  .explorer-controls {
    width: 100%;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    max-height: 70vh;
    overflow-y: auto;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }

  .explorer-controls:not(.is-open) {
    transform: translateY(100%);
    width: 100%;
  }

  .controls-content {
    border-radius: 16px 16px 0 0;
  }

  .explorer-canvas {
    padding-bottom: 80px; /* Space for controls toggle */
  }
}
</style>
