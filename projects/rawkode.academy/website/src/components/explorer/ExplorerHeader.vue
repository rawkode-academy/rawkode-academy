<template>
  <header class="explorer-header">
    <div class="header-left">
      <!-- View mode selector (hidden when only one view available) -->
      <div v-if="availableViewModes.length > 1" class="view-selector">
        <button
          v-for="mode in availableViewModes"
          :key="mode.id"
          type="button"
          class="view-btn"
          :class="{ active: viewMode === mode.id }"
          :title="mode.description"
          @click="$emit('update:viewMode', mode.id)"
        >
          <span class="view-icon">{{ mode.icon }}</span>
          <span class="view-name">{{ mode.name }}</span>
        </button>
      </div>
    </div>

    <div class="header-center">
      <!-- Preset selector -->
      <div class="preset-selector">
        <button
          v-for="preset in availablePresets"
          :key="preset.id"
          type="button"
          class="preset-btn"
          :class="{ active: activePreset?.id === preset.id }"
          :title="preset.description"
          @click="$emit('applyPreset', preset.id)"
        >
          <span class="preset-icon">{{ preset.icon }}</span>
          <span class="preset-name">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <div class="header-right">
      <!-- Filter count badge -->
      <button
        type="button"
        class="controls-toggle"
        :class="{ 'has-filters': filterCount > 0 }"
        @click="$emit('toggleControls')"
      >
        <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span class="toggle-label">{{ showControls ? 'Hide' : 'Show' }} Controls</span>
        <span v-if="filterCount > 0" class="filter-badge">{{ filterCount }}</span>
      </button>

      <!-- Share button -->
      <button
        type="button"
        class="share-btn"
        title="Copy shareable link"
        @click="$emit('share')"
      >
        <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span class="share-label">Share</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ViewMode, ExplorerPreset } from "@/lib/explorer/presets";
import { VIEW_MODES, getPresetsForPhase } from "@/lib/explorer/presets";

interface Props {
	viewMode: ViewMode;
	activePreset: ExplorerPreset | null;
	filterCount: number;
	showControls: boolean;
}

const props = defineProps<Props>();

defineEmits<{
	"update:viewMode": [mode: ViewMode];
	applyPreset: [presetId: string];
	toggleControls: [];
	share: [];
}>();

// Phase 1: Only show grid view
const currentPhase = 1;

const availableViewModes = computed(() => {
	return VIEW_MODES.filter((v) => v.phase <= currentPhase);
});

const availablePresets = computed(() => {
	return getPresetsForPhase(currentPhase as 1 | 2 | 3);
});
</script>

<style scoped>
.explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* View selector */
.view-selector {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-card-muted);
  border-radius: 10px;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary-content);
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-btn:hover {
  background: var(--surface-card);
  color: var(--text-primary-content);
}

.view-btn.active {
  background: rgb(var(--brand-primary));
  color: white;
}

.view-icon {
  font-size: 1rem;
}

/* Preset selector */
.preset-selector {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.preset-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--surface-card-muted);
  border: 1px solid transparent;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary-content);
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  border-color: var(--surface-border);
  color: var(--text-primary-content);
}

.preset-btn.active {
  background: rgb(var(--brand-primary) / 0.15);
  border-color: rgb(var(--brand-primary));
  color: rgb(var(--brand-primary));
}

.preset-icon {
  font-size: 0.875rem;
}

/* Controls toggle */
.controls-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary-content);
  cursor: pointer;
  transition: all 0.15s ease;
}

.controls-toggle:hover {
  background: var(--surface-card);
  color: var(--text-primary-content);
}

.controls-toggle.has-filters {
  border-color: rgb(var(--brand-primary));
}

.toggle-icon {
  width: 18px;
  height: 18px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.375rem;
  background: rgb(var(--brand-primary));
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 9999px;
}

/* Share button */
.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: rgb(var(--brand-primary));
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.share-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(var(--brand-primary) / 0.3);
}

.share-icon {
  width: 16px;
  height: 16px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .explorer-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .header-left,
  .header-center,
  .header-right {
    width: 100%;
    justify-content: center;
  }

  .preset-selector {
    justify-content: center;
  }

  .toggle-label,
  .share-label,
  .view-name {
    display: none;
  }

  .view-btn,
  .controls-toggle,
  .share-btn {
    padding: 0.5rem;
  }
}
</style>
