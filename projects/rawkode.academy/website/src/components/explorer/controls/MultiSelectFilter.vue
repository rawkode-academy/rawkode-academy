<template>
 <Popover.Root
 :open="isOpen"
 :lazy-mount="true"
 :unmount-on-exit="true"
 @open-change="isOpen = $event.open"
 >
 <Popover.Trigger
 class="filter-toggle"
 :class="{ 'has-selection': selected.length > 0 }"
 >
 <span class="filter-label">{{ label }}</span>
 <span v-if="selected.length > 0" class="selection-badge">
 {{ selected.length }}
 </span>
 <svg
 class="toggle-icon"
 :class="{ 'is-open': isOpen }"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 >
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
 </svg>
 </Popover.Trigger>

 <Popover.Positioner class="filter-positioner">
 <Popover.Content class="filter-dropdown">
 <!-- Select all / clear -->
 <div class="dropdown-actions">
 <button type="button" class="action-btn" @click="selectAll">
 Select all
 </button>
 <button
 type="button"
 class="action-btn"
 :disabled="selected.length === 0"
 @click="clearSelection"
 >
 Clear
 </button>
 </div>

 <!-- Options -->
 <div class="dropdown-options">
 <label
 v-for="value in values"
 :key="value"
 class="option-item"
 >
 <input
 type="checkbox"
 :checked="selected.includes(value)"
 class="option-checkbox"
 @change="toggleValue(value)"
 />
 <span
 class="option-color"
 :style="{ backgroundColor: getValueColor(value) }"
 ></span>
 <span class="option-label">{{ getValueLabel(value) }}</span>
 </label>
 </div>
 </Popover.Content>
 </Popover.Positioner>
</Popover.Root>
</template>

<script setup lang="ts">
import { Popover } from "@ark-ui/vue/popover";
import { ref } from "vue";
import {
	getDimensionLabel,
	getDimensionColor,
	type DimensionKey,
} from "@/lib/explorer/dimensions";

interface Props {
	dimension: DimensionKey;
	label: string;
	values: string[];
	selected: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
	"update:selected": [values: string[]];
}>();

const isOpen = ref(false);

const getValueLabel = (value: string): string => {
	return getDimensionLabel(props.dimension, value);
};

const getValueColor = (value: string): string => {
	return getDimensionColor(props.dimension, value);
};

const toggleValue = (value: string) => {
	const newSelected = props.selected.includes(value)
		? props.selected.filter((v) => v !== value)
		: [...props.selected, value];
	emit("update:selected", newSelected);
};

const selectAll = () => {
	emit("update:selected", [...props.values]);
};

const clearSelection = () => {
	emit("update:selected", []);
};
</script>

<style scoped>
.multi-select-filter {
 position: relative;
}

.filter-toggle {
 display: flex;
 align-items: center;
 width: 100%;
 gap: 0.5rem;
 padding: 0.5rem 0.75rem;
 background: var(--colors-academy-ground);
 border: 1px solid var(--colors-academy-border);
 border-radius: 8px;
 font-size: 0.8rem;
 font-weight: 600;
 color: var(--colors-academy-text-soft);
 cursor: pointer;
 transition: all 0.15s ease;
}

.filter-toggle:hover {
 border-color: color-mix(in srgb, var(--colors-academy-accent) 50%, transparent);
 color: var(--colors-academy-text);
}

.filter-toggle.has-selection {
 border-color: var(--colors-academy-accent);
 background: color-mix(in srgb, var(--colors-academy-accent) 10%, transparent);
}

.filter-label {
 flex: 1;
 text-align: left;
}

.selection-badge {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 min-width: 20px;
 height: 20px;
 padding: 0 0.375rem;
 background: var(--colors-academy-accent);
 color: var(--colors-academy-accent-foreground);
 font-size: 0.65rem;
 font-weight: 700;
 border-radius: 9999px;
}

.toggle-icon {
 width: 14px;
 height: 14px;
 transition: transform 0.2s ease;
}

.toggle-icon.is-open {
 transform: rotate(180deg);
}
</style>

<style>
/* Dropdown styles - global because teleported to body */
.filter-dropdown {
 width: var(--reference-width);
 max-height: min(400px, var(--available-height));
 background: var(--colors-academy-panel);
 border: 1px solid var(--colors-academy-border);
 border-radius: 10px;
 box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
 display: flex;
 flex-direction: column;
 overflow: hidden;
}

.filter-positioner { z-index: 9999; }

.filter-dropdown .dropdown-actions {
 display: flex;
 gap: 0.5rem;
 padding: 0.5rem;
 border-bottom: 1px solid var(--colors-academy-border);
}

.filter-dropdown .action-btn {
 flex: 1;
 padding: 0.375rem 0.5rem;
 background: var(--colors-academy-ground);
 border: none;
 border-radius: 6px;
 font-size: 0.7rem;
 font-weight: 600;
 color: var(--colors-academy-text-soft);
 cursor: pointer;
 transition: all 0.15s ease;
}

.filter-dropdown .action-btn:hover:not(:disabled) {
 background: var(--colors-academy-border);
 color: var(--colors-academy-text);
}

.filter-dropdown .action-btn:disabled {
 opacity: 0.5;
 cursor: not-allowed;
}

.filter-dropdown .dropdown-options {
 flex: 1;
 min-height: 0;
 overflow-y: auto;
 padding: 0.5rem;
}

.filter-dropdown .option-item {
 display: flex;
 align-items: center;
 gap: 0.5rem;
 padding: 0.5rem;
 border-radius: 6px;
 cursor: pointer;
 transition: background 0.1s ease;
}

.filter-dropdown .option-item:hover {
 background: var(--colors-academy-ground);
}

.filter-dropdown .option-checkbox {
 width: 18px;
 height: 18px;
 accent-color: var(--colors-academy-accent);
 cursor: pointer;
}

.filter-dropdown .option-color {
 width: 14px;
 height: 14px;
 border-radius: 4px;
 flex-shrink: 0;
}

.filter-dropdown .option-label {
 font-size: 0.875rem;
 color: var(--colors-academy-text);
}

/* Transition */
.dropdown-enter-active,
.dropdown-leave-active {
 transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
 opacity: 0;
 transform: translateY(-0.5rem);
}
</style>
