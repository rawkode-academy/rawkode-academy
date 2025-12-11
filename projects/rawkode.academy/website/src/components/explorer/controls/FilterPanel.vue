<template>
  <div class="filter-panel">
    <div class="filter-header">
      <h3 class="filter-title">Filters</h3>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="clear-btn"
        @click="handleClear"
      >
        Clear all
      </button>
    </div>

    <!-- Search -->
    <div class="filter-search">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        :value="filters.search"
        type="text"
        placeholder="Search technologies..."
        class="search-input"
        @input="handleSearchInput"
      />
    </div>

    <!-- Filter sections -->
    <div class="filter-sections">
      <MultiSelectFilter
        v-for="dimension in filterDimensions"
        :key="dimension.key"
        :dimension="dimension.key"
        :label="dimension.label"
        :values="availableValues[dimension.key] || []"
        :selected="(filters[dimension.key] as string[]) || []"
        @update:selected="(values: string[]) => handleFilterUpdate(dimension.key, values)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import type { DimensionKey } from "@/lib/explorer/dimensions";
import type { ExplorerFilters } from "@/lib/explorer/presets";
import MultiSelectFilter from "./MultiSelectFilter.vue";

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface Props {
	filters: ExplorerFilters;
	availableValues: Record<DimensionKey, string[]>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: "update:filter", dimension: DimensionKey, values: string[]): void;
	(e: "update:search", query: string): void;
	(e: "clear"): void;
}>();

// Track filter changes
const handleFilterUpdate = (dimension: DimensionKey, values: string[]) => {
	trackEvent("filter_applied", {
		filter_type: dimension,
		filter_values: values,
		values_count: values.length,
		context: "explorer",
	});
	emit("update:filter", dimension, values);
};

// Track clear filters
const handleClear = () => {
	trackEvent("filter_cleared", {
		context: "explorer",
	});
	emit("clear");
};

// Dimensions to show as filters
const filterDimensions: Array<{ key: DimensionKey; label: string }> = [
	{ key: "matrix.status", label: "Pipeline Stage" },
	{ key: "cncf.status", label: "CNCF Status" },
	{ key: "category", label: "Category" },
	{ key: "matrix.trajectory", label: "Trajectory" },
];

const hasActiveFilters = computed(() => {
	if (props.filters.search?.trim()) return true;

	for (const dim of filterDimensions) {
		const values = props.filters[dim.key] as string[];
		if (values && values.length > 0) return true;
	}

	return false;
});

const handleSearchInput = (event: Event) => {
	const target = event.target as HTMLInputElement;
	emit("update:search", target.value);
};
</script>

<style scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: visible;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0;
}

.clear-btn {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgb(239, 68, 68);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.clear-btn:hover {
  opacity: 0.8;
}

/* Search */
.filter-search {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 0.625rem 0.75rem 0.625rem 2.25rem;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-primary-content);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  outline: none;
  border-color: rgb(var(--brand-primary));
  box-shadow: 0 0 0 3px rgb(var(--brand-primary) / 0.15);
}

/* Filter sections */
.filter-sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: visible;
}
</style>
