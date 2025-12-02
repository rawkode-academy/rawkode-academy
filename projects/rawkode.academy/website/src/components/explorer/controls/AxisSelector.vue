<template>
  <div class="axis-selector">
    <label class="axis-label">{{ label }}</label>
    <div class="select-wrapper">
      <select
        :value="value"
        class="axis-select"
        @change="handleChange"
      >
        <option
          v-for="option in axisOptions"
          :key="option.key"
          :value="option.key"
        >
          {{ option.label }}
        </option>
      </select>
      <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
    <p class="axis-description">{{ currentDescription }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getAxisOptions, type DimensionKey } from "@/lib/explorer/dimensions";

interface Props {
	label: string;
	value: DimensionKey;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	"update:value": [value: DimensionKey];
}>();

const axisOptions = getAxisOptions();

const currentDescription = computed(() => {
	const option = axisOptions.find((o) => o.key === props.value);
	return option?.description ?? "";
});

const handleChange = (event: Event) => {
	const target = event.target as HTMLSelectElement;
	emit("update:value", target.value as DimensionKey);
};
</script>

<style scoped>
.axis-selector {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.axis-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary-content);
}

.select-wrapper {
  position: relative;
}

.axis-select {
  width: 100%;
  padding: 0.625rem 2rem 0.625rem 0.75rem;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary-content);
  cursor: pointer;
  appearance: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.axis-select:hover {
  border-color: rgb(var(--brand-primary) / 0.5);
}

.axis-select:focus {
  outline: none;
  border-color: rgb(var(--brand-primary));
  box-shadow: 0 0 0 3px rgb(var(--brand-primary) / 0.15);
}

.select-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}

.axis-description {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
