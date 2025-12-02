<template>
  <div class="grid-view">
    <!-- Column headers (X-axis) -->
    <div class="grid-header" :style="{ gridTemplateColumns: gridColumnsWithoutHeader }">
      <div
        v-for="xValue in xAxisValues"
        :key="String(xValue)"
        class="header-cell"
        :style="{ '--header-color': getXAxisColor(xValue) }"
      >
        <span class="header-label">{{ getXAxisLabel(xValue) }}</span>
        <span class="header-count">{{ getColumnCount(xValue) }}</span>
      </div>
    </div>

    <!-- Grid rows (Y-axis) -->
    <div class="grid-body">
      <div
        v-for="yValue in yAxisValues"
        :key="String(yValue)"
        class="row-wrapper"
      >
        <!-- Manila folder tab -->
        <div class="row-tabs">
          <div class="row-tab" :style="{ '--tab-color': getYAxisColor(yValue) }">
            <span class="tab-icon">{{ getYAxisIcon(yValue) }}</span>
            <span class="tab-title">{{ getYAxisLabel(yValue) }}</span>
            <span class="tab-count">{{ getRowCount(yValue) }}</span>
          </div>
        </div>

        <!-- Row content -->
        <div
          class="grid-row"
          :style="{ gridTemplateColumns: gridColumnsWithoutHeader }"
        >
          <!-- Cells -->
          <div
            v-for="xValue in xAxisValues"
            :key="`${String(yValue)}-${String(xValue)}`"
            class="grid-cell"
            :style="{ '--cell-color': getXAxisColor(xValue) }"
          >
            <div class="cell-content">
              <a
                v-for="tech in getCellTechnologies(yValue, xValue)"
                :key="tech.id"
                :href="`/technology/${tech.id}`"
                class="tech-icon"
                :data-name="tech.name"
                :class="{ 'is-hovered': hoveredTechId === tech.id }"
                @mouseenter="$emit('hover', tech.id)"
                @mouseleave="$emit('hover', null)"
                @click.prevent="$emit('select', tech.id)"
              >
                <img
                  v-if="tech.icon"
                  :src="tech.icon"
                  :alt="tech.name"
                  class="icon-img"
                  loading="lazy"
                />
                <span v-else class="icon-initial">{{ tech.name[0] }}</span>
                <span
                  v-if="tech.dimensions['matrix.trajectory']"
                  class="icon-trajectory"
                  :class="`trajectory-${tech.dimensions['matrix.trajectory']}`"
                >
                  {{ getTrajectoryEmoji(tech.dimensions['matrix.trajectory']) }}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="technologies.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No technologies found</h3>
      <p>Try adjusting your filters or search query</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { NormalizedTechnology } from "@/lib/explorer/data-layer";
import type { DimensionKey } from "@/lib/explorer/dimensions";
import {
	getDimensionLabel,
	getDimensionColor,
	DIMENSIONS,
} from "@/lib/explorer/dimensions";

interface Props {
	technologies: NormalizedTechnology[];
	gridData: Map<string | null, Map<string | null, NormalizedTechnology[]>>;
	xAxis: DimensionKey;
	yAxis: DimensionKey;
	xAxisValues: (string | null)[];
	yAxisValues: (string | null)[];
	hoveredTechId: string | null;
}

const props = defineProps<Props>();

defineEmits<{
	hover: [id: string | null];
	select: [id: string | null];
}>();

// Grid columns CSS - row header fixed, columns fill available space equally
const gridColumns = computed(() => {
	const colCount = props.xAxisValues.length;
	return `200px repeat(${colCount}, 1fr)`;
});

// Grid columns without header (for manila tab layout)
const gridColumnsWithoutHeader = computed(() => {
	const colCount = props.xAxisValues.length;
	return `repeat(${colCount}, 1fr)`;
});

// X-axis helpers
const getXAxisLabel = (value: string | null): string => {
	return getDimensionLabel(props.xAxis, value);
};

const getXAxisColor = (value: string | null): string => {
	return getDimensionColor(props.xAxis, value);
};

const getColumnCount = (xValue: string | null): number => {
	let count = 0;
	for (const yValue of props.yAxisValues) {
		const row = props.gridData.get(yValue);
		if (row) {
			const cell = row.get(xValue);
			if (cell) {
				count += cell.length;
			}
		}
	}
	return count;
};

// Y-axis helpers
const getYAxisLabel = (value: string | null): string => {
	return getDimensionLabel(props.yAxis, value);
};

const getYAxisColor = (value: string | null): string => {
	return getDimensionColor(props.yAxis, value);
};

const getYAxisIcon = (value: string | null): string => {
	// Return emoji icons for known groupings
	if (props.yAxis === "matrix.grouping") {
		const icons: Record<string, string> = {
			plumbing: "🔧",
			platform: "🏗️",
			observability: "📊",
			security: "🔒",
		};
		return value ? (icons[value] ?? "📦") : "📦";
	}
	return "📦";
};

const getRowCount = (yValue: string | null): number => {
	const row = props.gridData.get(yValue);
	if (!row) return 0;
	let count = 0;
	for (const cell of row.values()) {
		count += cell.length;
	}
	return count;
};

// Cell helpers
const getCellTechnologies = (
	yValue: string | null,
	xValue: string | null,
): NormalizedTechnology[] => {
	const row = props.gridData.get(yValue);
	if (!row) return [];
	return row.get(xValue) ?? [];
};

// Trajectory emoji
const getTrajectoryEmoji = (trajectory: string | null): string => {
	const emojis: Record<string, string> = {
		rising: "↗",
		stable: "→",
		falling: "↘",
	};
	return trajectory ? (emojis[trajectory] ?? "") : "";
};
</script>

<style scoped>
.grid-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-x: auto;
  min-width: 0;
}

/* Header */
.grid-header {
  display: grid;
  gap: 2px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface-background);
  padding-bottom: 0.5rem;
}

.header-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.5rem;
  background: var(--header-color);
  border-radius: 8px 8px 0 0;
  color: white;
  text-align: center;
}

.header-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.header-count {
  font-size: 0.65rem;
  opacity: 0.8;
}

/* Grid body */
.grid-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Row wrapper - contains tab + content */
.row-wrapper {
  display: flex;
  flex-direction: column;
}

/* Manila folder tabs */
.row-tabs {
  display: flex;
  align-items: flex-end;
}

.row-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem 0.375rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  margin-left: 1rem;
  position: relative;
  z-index: 1;
  margin-bottom: -1px;
}

.tab-icon {
  font-size: 1rem;
}

.tab-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-primary-content);
}

.tab-count {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  background: var(--tab-color);
  color: white;
  border-radius: 4px;
  min-width: 1.25rem;
  text-align: center;
}

.grid-row {
  display: grid;
  gap: 0;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  overflow: hidden;
}

/* Grid cells */
.grid-cell {
  padding: 0.5rem;
  min-height: 50px;
  background: rgb(from var(--cell-color) r g b / 0.05);
  border-left: 1px solid var(--surface-border);
  overflow: hidden;
}

.cell-content {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
  align-content: flex-start;
  width: 100%;
}

/* Tech icons */
.tech-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.tech-icon:hover,
.tech-icon.is-hovered {
  transform: scale(1.15);
  border-color: rgb(var(--brand-primary));
  box-shadow: 0 0 0 3px rgb(var(--brand-primary) / 0.2);
  z-index: 50;
}

/* Tech icon tooltip */
.tech-icon::after {
  content: attr(data-name);
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 0.625rem 1rem;
  background: rgba(17, 24, 39, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 2px solid rgb(var(--brand-primary));
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #f9fafb;
  white-space: nowrap;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 100;
}

:global(html.dark) .tech-icon::after {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.15);
  border-top-color: rgb(var(--brand-primary));
}

/* Tooltip arrow */
.tech-icon::before {
  content: "";
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgba(17, 24, 39, 0.85);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 100;
}

:global(html.dark) .tech-icon::before {
  border-top-color: rgba(0, 0, 0, 0.8);
}

.tech-icon:hover::after,
.tech-icon:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 4px;
}

.icon-initial {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-card-muted);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-primary-content);
}

.icon-trajectory {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 0.6rem;
  font-weight: 700;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-card);
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  line-height: 1;
}

.trajectory-rising {
  color: rgb(34, 197, 94);
}

.trajectory-stable {
  color: rgb(156, 163, 175);
}

.trajectory-falling {
  color: rgb(239, 68, 68);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary-content);
  margin: 0 0 0.5rem;
}

.empty-state p {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .grid-header {
    display: none;
  }

  .row-tabs {
    margin-bottom: 0;
  }

  .row-tab {
    margin-left: 0.5rem;
    padding: 0.375rem 0.75rem 0.25rem;
  }

  .grid-row {
    display: flex;
    flex-direction: column;
    border-radius: 0 12px 12px 12px;
  }

  .grid-cell {
    border-left: none;
    border-top: 1px solid var(--surface-border);
    padding: 0.75rem 1rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .grid-cell:first-child {
    border-top: none;
  }

  .grid-cell::before {
    content: attr(data-column);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cell-color);
  }

  .cell-content {
    gap: 0.75rem;
  }

  .tech-icon {
    width: 40px;
    height: 40px;
  }

  .icon-img {
    width: 24px;
    height: 24px;
  }

  /* Hide tooltips on mobile */
  .tech-icon::after,
  .tech-icon::before {
    display: none;
  }
}
</style>
