<template>
  <div ref="triggerRef" class="multi-select-filter">
    <button
      type="button"
      class="filter-toggle"
      :class="{ 'has-selection': selected.length > 0 }"
      @click="toggleDropdown"
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
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="filter-dropdown"
          :style="dropdownStyle"
          @click.stop
        >
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
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
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
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownPosition = ref({
	top: 0,
	bottom: 0,
	left: 0,
	width: 0,
	maxHeight: 400,
	openUpward: false,
});

const dropdownStyle = computed(() => ({
	position: "fixed" as const,
	top: dropdownPosition.value.openUpward
		? "auto"
		: `${dropdownPosition.value.top}px`,
	bottom: dropdownPosition.value.openUpward
		? `${dropdownPosition.value.bottom}px`
		: "auto",
	left: `${dropdownPosition.value.left}px`,
	width: `${dropdownPosition.value.width}px`,
	maxHeight: `${dropdownPosition.value.maxHeight}px`,
}));

const updateDropdownPosition = () => {
	if (!triggerRef.value) return;
	const rect = triggerRef.value.getBoundingClientRect();
	const viewportHeight = window.innerHeight;
	const spaceBelow = viewportHeight - rect.bottom - 16;
	const spaceAbove = rect.top - 16;
	const minDropdownHeight = 200;

	// Prefer opening downward if there's enough space
	const openUpward = spaceBelow < minDropdownHeight && spaceAbove > spaceBelow;
	const maxHeight = openUpward
		? Math.min(spaceAbove, 400)
		: Math.min(spaceBelow, 400);

	dropdownPosition.value = {
		top: rect.bottom + 8,
		bottom: viewportHeight - rect.top + 8,
		left: rect.left,
		width: rect.width,
		maxHeight,
		openUpward,
	};
};

const toggleDropdown = () => {
	isOpen.value = !isOpen.value;
	if (isOpen.value) {
		nextTick(() => {
			updateDropdownPosition();
		});
	}
};

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

// Close on click outside
const handleClickOutside = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	if (
		triggerRef.value &&
		!triggerRef.value.contains(target) &&
		dropdownRef.value &&
		!dropdownRef.value.contains(target)
	) {
		isOpen.value = false;
	}
};

// Update position on scroll/resize
const handleScrollResize = () => {
	if (isOpen.value) {
		updateDropdownPosition();
	}
};

onMounted(() => {
	document.addEventListener("click", handleClickOutside);
	window.addEventListener("scroll", handleScrollResize, true);
	window.addEventListener("resize", handleScrollResize);
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
	window.removeEventListener("scroll", handleScrollResize, true);
	window.removeEventListener("resize", handleScrollResize);
});
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
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary-content);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-toggle:hover {
  border-color: rgb(var(--brand-primary) / 0.5);
  color: var(--text-primary-content);
}

.filter-toggle.has-selection {
  border-color: rgb(var(--brand-primary));
  background: rgb(var(--brand-primary) / 0.1);
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
  background: rgb(var(--brand-primary));
  color: white;
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
  z-index: 9999;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filter-dropdown .dropdown-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.filter-dropdown .action-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: var(--surface-card-muted);
  border: none;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary-content);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-dropdown .action-btn:hover:not(:disabled) {
  background: var(--surface-border);
  color: var(--text-primary-content);
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
  background: var(--surface-card-muted);
}

.filter-dropdown .option-checkbox {
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--brand-primary));
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
  color: var(--text-primary-content);
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
