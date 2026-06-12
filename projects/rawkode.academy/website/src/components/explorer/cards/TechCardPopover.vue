<template>
 <Teleport to="body">
 <dialog
 ref="dialogEl"
 class="tech-card-popover"
 :aria-label="technology.name"
 @click="onDialogClick"
 @close="$emit('close')"
 >
 <button type="button" class="close-btn" @click="dialogEl?.close()" aria-label="Close">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>

 <div class="card-frame">
 <!-- Header -->
 <div class="card-header" :class="statusClass">
 <div class="card-icon-wrapper">
 <img
 v-if="technology.icon"
 :src="technology.icon"
 :alt="technology.name"
 class="card-icon"
 />
 <div v-else class="card-icon-placeholder">
 {{ technology.name[0] }}
 </div>
 </div>
 <div class="card-titles">
 <h3 class="card-name">{{ technology.name }}</h3>
 <div class="card-meta">
 <span class="card-status-badge" :class="statusClass">{{ statusLabel }}</span>
 <span class="card-category">{{ categoryLabel }}</span>
 </div>
 </div>
 </div>

 <!-- Body -->
 <div class="card-body">
 <!-- Why section -->
 <div v-if="technology.cardData.why" class="card-section">
 <div class="section-label">Why I use it</div>
 <p class="section-text">{{ technology.cardData.why }}</p>
 </div>

 <!-- Stats -->
 <div class="card-stats">
 <div class="stat">
 <span class="stat-value">{{ technology.metrics.videoCount || 0 }}</span>
 <span class="stat-label">Videos</span>
 </div>
 <!-- Hidden until article links are wired up; a permanent zero reads as broken -->
 <div v-if="technology.metrics.articleCount" class="stat">
 <span class="stat-value">{{ technology.metrics.articleCount }}</span>
 <span class="stat-label">Articles</span>
 </div>
 <div class="stat">
 <span class="stat-value">{{ technology.cardData.firstUsed ? formatDate(technology.cardData.firstUsed) : '–' }}</span>
 <span class="stat-label">First Used</span>
 </div>
 <div class="stat">
 <span class="stat-value">{{ trajectoryIcon }}</span>
 <span class="stat-label">Trajectory</span>
 </div>
 </div>

 <!-- Spicy take -->
 <div v-if="technology.cardData.spicyTake" class="card-spicy">
 <span class="spicy-icon">🌶️</span>
 <span class="spicy-text">{{ technology.cardData.spicyTake }}</span>
 </div>
 </div>

 <!-- Footer -->
 <div class="card-footer">
 <a :href="`/technology/${technology.id}`" class="card-cta">
 <span>View Details</span>
 <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
 </svg>
 </a>
 </div>
 </div>
 </dialog>
 </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { NormalizedTechnology } from "@/lib/explorer/data-layer";
import { getDimensionLabel } from "@/lib/explorer/dimensions";

interface Props {
	technology: NormalizedTechnology;
}

const props = defineProps<Props>();

defineEmits<{
	close: [];
}>();

// Native <dialog>: focus trapping, Escape, and focus return come from the
// platform. The close event bubbles up as the component's close emit.
const dialogEl = ref<HTMLDialogElement | null>(null);

onMounted(() => {
	dialogEl.value?.showModal();
});

const onDialogClick = (event: MouseEvent) => {
	// Clicks on ::backdrop target the dialog element itself
	if (event.target === dialogEl.value) {
		dialogEl.value?.close();
	}
};

const statusLabel = computed(() => {
	return getDimensionLabel(
		"matrix.status",
		props.technology.dimensions["matrix.status"],
	);
});

const categoryLabel = computed(() => {
	return getDimensionLabel("category", props.technology.dimensions["category"]);
});

const statusClass = computed(() => {
	const status = props.technology.dimensions["matrix.status"];
	return status ? `status-${status}` : "";
});

const trajectoryIcon = computed(() => {
	const trajectory = props.technology.dimensions["matrix.trajectory"];
	const icons: Record<string, string> = {
		rising: "↗️",
		stable: "→",
		falling: "↘️",
	};
	return trajectory ? icons[trajectory] || "–" : "–";
});

const formatDate = (dateStr: string | null): string => {
	if (!dateStr) return "–";
	const [year, month] = dateStr.split("-");
	if (!year || !month) return dateStr;
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[parseInt(month, 10) - 1]} ${year}`;
};
</script>

<style scoped>
/* =================================
 Modal Container (native <dialog>)
 ================================= */
dialog.tech-card-popover {
 /* Stage colors derive from the editorial palette, mirroring the matrix page */
 --stage-skip: var(--editorial-rust);
 --stage-watch: var(--editorial-amber-text);
 --stage-explore: color-mix(
 in oklab,
 var(--editorial-amber-text) 45%,
 var(--editorial-spruce) 55%
 );
 --stage-learn: var(--editorial-violet);
 --stage-adopt: var(--editorial-spruce);
 --stage-advocate: var(--editorial-ink);
 --stage-graveyard: var(--editorial-ink-mute);

 width: 480px;
 max-width: calc(100vw - 3rem);
 max-height: calc(100vh - 4rem);
 padding: 0;
 border: none;
 background: transparent;
 margin: auto;
 overflow: visible;
}

:global(html.dark) dialog.tech-card-popover {
 --stage-learn: color-mix(in oklab, var(--editorial-violet) 60%, white 40%);
}

dialog.tech-card-popover::backdrop {
 background: rgb(0 0 0 / 0.6);
}

dialog.tech-card-popover[open] {
 animation: scaleIn 0.2s var(--ease-standard, ease);
}

@keyframes scaleIn {
 from {
 opacity: 0;
 transform: scale(0.97);
 }
}

@media (prefers-reduced-motion: reduce) {
 dialog.tech-card-popover[open] {
 animation: none;
 }
}

/* =================================
 Close Button
 ================================= */
.close-btn {
 position: absolute;
 top: 1rem;
 right: 1rem;
 z-index: 10;
 width: 40px;
 height: 40px;
 display: flex;
 align-items: center;
 justify-content: center;
 background: var(--surface-card);
 border: 1px solid var(--surface-border);
 border-radius: 50%;
 color: var(--text-muted);
 cursor: pointer;
 transition: background-color 0.15s ease, color 0.15s ease;
}

.close-btn:hover {
 background: var(--surface-card-muted);
 color: var(--text-primary-content);
}

/* =================================
 Card Frame
 ================================= */
.card-frame {
 background: var(--surface-card);
 border: 1px solid var(--editorial-hairline-strong);
 border-radius: var(--radius-4xl);
 overflow: hidden;
 max-height: calc(100vh - 4rem);
 overflow-y: auto;
}

/* =================================
 Header
 ================================= */
.card-header {
 display: flex;
 align-items: center;
 gap: 1.25rem;
 padding: 1.75rem;
 background: var(--surface-card-muted);
 border-bottom: 4px solid var(--text-muted);
}

.card-header.status-skip { border-bottom-color: var(--stage-skip); }
.card-header.status-watch { border-bottom-color: var(--stage-watch); }
.card-header.status-explore { border-bottom-color: var(--stage-explore); }
.card-header.status-learn { border-bottom-color: var(--stage-learn); }
.card-header.status-adopt { border-bottom-color: var(--stage-adopt); }
.card-header.status-advocate { border-bottom-color: var(--stage-advocate); }
.card-header.status-graveyard { border-bottom-color: var(--stage-graveyard); }

.card-icon-wrapper {
 flex-shrink: 0;
}

.card-icon {
 width: 80px;
 height: 80px;
 object-fit: contain;
 border-radius: var(--radius-4xl);
 background: var(--surface-card);
 padding: 0.875rem;
 border: 1px solid var(--surface-border);
}

.card-icon-placeholder {
 width: 80px;
 height: 80px;
 display: flex;
 align-items: center;
 justify-content: center;
 background: var(--surface-card);
 border-radius: var(--radius-4xl);
 border: 1px solid var(--surface-border);
 font-size: 2rem;
 font-weight: 700;
 color: var(--text-primary-content);
}

.card-titles {
 flex: 1;
 min-width: 0;
}

.card-name {
 font-size: 1.75rem;
 font-weight: 700;
 color: var(--text-primary-content);
 margin: 0 0 0.625rem;
 line-height: 1.2;
}

.card-meta {
 display: flex;
 align-items: center;
 gap: 0.75rem;
 flex-wrap: wrap;
}

.card-status-badge {
 font-size: 0.75rem;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.04em;
 padding: 0.375rem 0.75rem;
 border-radius: var(--radius-md);
 color: var(--surface-base);
 background: var(--text-muted);
}

.card-status-badge.status-skip { background: var(--stage-skip); }
.card-status-badge.status-watch { background: var(--stage-watch); }
.card-status-badge.status-explore { background: var(--stage-explore); }
.card-status-badge.status-learn { background: var(--stage-learn); }
.card-status-badge.status-adopt { background: var(--stage-adopt); }
.card-status-badge.status-advocate { background: var(--stage-advocate); }
.card-status-badge.status-graveyard { background: var(--stage-graveyard); }

.card-category {
 font-size: 0.875rem;
 color: var(--text-secondary-content);
}

/* =================================
 Body
 ================================= */
.card-body {
 display: flex;
 flex-direction: column;
 gap: 1.25rem;
 padding: 1.5rem 1.75rem;
}

/* Section */
.card-section {
 display: flex;
 flex-direction: column;
 gap: 0.5rem;
}

.section-label {
 font-size: 0.6875rem;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.08em;
 color: var(--text-muted);
}

.section-text {
 font-size: 0.9375rem;
 line-height: 1.6;
 color: var(--text-secondary-content);
 margin: 0;
}

/* Stats */
.card-stats {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
 gap: 0.75rem;
}

.stat {
 display: flex;
 flex-direction: column;
 align-items: center;
 gap: 0.25rem;
 padding: 0.875rem 0.5rem;
 background: var(--surface-card-muted);
 border-radius: var(--radius-3xl);
}

.stat-value {
 font-size: 1rem;
 font-weight: 700;
 color: var(--text-primary-content);
}

.stat-label {
 font-size: 0.625rem;
 font-weight: 600;
 text-transform: uppercase;
 letter-spacing: 0.04em;
 color: var(--text-muted);
 text-align: center;
}

/* Spicy take */
.card-spicy {
 display: flex;
 align-items: flex-start;
 gap: 0.75rem;
 padding: 1rem;
 background: color-mix(in oklab, var(--editorial-rust) 8%, transparent);
 border: 1px solid color-mix(in oklab, var(--editorial-rust) 18%, transparent);
 border-radius: var(--radius-3xl);
}

.spicy-icon {
 font-size: 1.125rem;
 flex-shrink: 0;
 line-height: 1.4;
}

.spicy-text {
 font-size: 0.875rem;
 font-style: italic;
 color: var(--editorial-rust);
 line-height: 1.5;
}

/* =================================
 Footer
 ================================= */
.card-footer {
 padding: 0 1.75rem 1.75rem;
}

.card-cta {
 display: flex;
 align-items: center;
 justify-content: center;
 gap: 0.625rem;
 width: 100%;
 padding: 1rem 1.5rem;
 background: var(--editorial-ink);
 color: var(--editorial-paper);
 border: 1px solid var(--editorial-ink);
 border-radius: var(--radius-md);
 font-size: 0.875rem;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.04em;
 text-decoration: none;
 transition: background-color 0.2s ease, border-color 0.2s ease;
}

.card-cta:hover {
 background: var(--editorial-spruce);
 border-color: var(--editorial-spruce);
}

.card-cta svg {
 transition: transform 0.2s ease;
}

.card-cta:hover svg {
 transform: translateX(4px);
}

/* =================================
 Mobile
 ================================= */
@media (max-width: 540px) {
 dialog.tech-card-popover {
 width: calc(100vw - 2rem);
 max-width: calc(100vw - 2rem);
 }

 .card-header {
 padding: 1.25rem;
 gap: 1rem;
 }

 .card-icon,
 .card-icon-placeholder {
 width: 64px;
 height: 64px;
 }

 .card-name {
 font-size: 1.375rem;
 }

 .card-body {
 padding: 1.25rem;
 }

 .card-stats {
 grid-template-columns: repeat(2, 1fr);
 }

 .card-footer {
 padding: 0 1.25rem 1.25rem;
 }
}
</style>
