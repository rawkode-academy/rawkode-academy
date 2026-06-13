<script setup lang="ts">
defineProps<{
	iconUrl: string;
	revealed: boolean;
}>();
</script>

<template>
	<div class="gtl-logo-card" :class="{ revealed }">
		<!-- Duotone mask layers (do NOT animate — static, no repaint) -->
		<div class="gtl-logo-duotone" aria-hidden="true">
			<div class="gtl-logo-mask-cyan" :style="`--icon-url: url(${iconUrl})`"></div>
			<div class="gtl-logo-mask-purple" :style="`--icon-url: url(${iconUrl})`"></div>
			<!-- Scanline overlay: GPU-composited translateY animation, no mask-position repaint -->
			<div class="gtl-scanline-overlay" aria-hidden="true"></div>
		</div>
		<img
			:src="iconUrl"
			alt=""
			class="gtl-logo-img"
			loading="lazy"
			decoding="async"
			aria-hidden="true"
		/>
	</div>
</template>

<style scoped>
/* Seamless scanline scroll: translateY by exactly one gradient period (4px) */
@keyframes scanline-scroll {
	from {
		transform: translateY(0) translateZ(0);
	}
	to {
		transform: translateY(4px) translateZ(0);
	}
}

.gtl-logo-card {
	position: relative;
	aspect-ratio: 1 / 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.25rem;
	border-radius: 1.5rem;
	background: color-mix(in srgb, #5f5ed7 5%, transparent);
	border: 1px solid var(--colors-border-muted, oklch(0.18 0.02 60 / 0.12));
	overflow: hidden;
	transition: border-color 250ms ease, background 250ms ease;
}

.gtl-logo-card::before {
	content: "";
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, color-mix(in srgb, #fff 4%, transparent), transparent 60%);
	pointer-events: none;
}

/* Container for duotone + scanlines — sized to the padded content area */
.gtl-logo-duotone {
	position: absolute;
	inset: 1.25rem;
	overflow: hidden;
}

/* Duotone mask layers — STATIC, no animation */
.gtl-logo-mask-cyan,
.gtl-logo-mask-purple {
	position: absolute;
	inset: 0;
	mask-image: var(--icon-url);
	-webkit-mask-image: var(--icon-url);
	mask-repeat: no-repeat;
	-webkit-mask-repeat: no-repeat;
	mask-position: center;
	-webkit-mask-position: center;
	mask-size: contain;
	-webkit-mask-size: contain;
}

.gtl-logo-mask-cyan {
	background-color: #00ceff;
	opacity: 0.28;
	mask-mode: alpha;
	-webkit-mask-mode: alpha;
}

.gtl-logo-mask-purple {
	background-color: #5f5ed7;
	mask-mode: luminance;
	-webkit-mask-mode: luminance;
}

/*
 * Scanline overlay: separate div, sized taller than parent so the
 * gradient tiles seamlessly as it translates. Only this layer moves —
 * GPU-composited via will-change + translateZ(0), zero repaints.
 *
 * The gradient period is 4px (2px opaque line + 2px transparent gap).
 * We animate translateY(0 -> 4px) so the loop is perfectly seamless.
 */
.gtl-scanline-overlay {
	position: absolute;
	/* Extend above and below by one period so edges never show a seam */
	top: -4px;
	left: 0;
	right: 0;
	bottom: -4px;
	background: repeating-linear-gradient(
		to bottom,
		rgba(0, 0, 0, 0.18) 0px,
		rgba(0, 0, 0, 0.18) 2px,
		transparent 2px,
		transparent 4px
	);
	will-change: transform;
	animation: scanline-scroll 1s linear infinite;
	transition: opacity 350ms ease;
	pointer-events: none;
}

/* Hide scanlines (and show full-colour image) when revealed */
.gtl-logo-card.revealed .gtl-logo-duotone {
	opacity: 0;
	transition: opacity 350ms ease;
}

.gtl-logo-card.revealed .gtl-scanline-overlay {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.gtl-scanline-overlay {
		animation: none;
	}
}

/*
 * Full-colour image: hidden during play, fades in on reveal.
 * Give it a stable aspect box (the card itself is 1:1) so there's no layout shift.
 */
.gtl-logo-img {
	position: absolute;
	inset: 1.25rem;
	width: calc(100% - 2.5rem);
	height: calc(100% - 2.5rem);
	object-fit: contain;
	opacity: 0;
	transition: opacity 350ms ease;
	pointer-events: none;
}

.gtl-logo-card.revealed .gtl-logo-img {
	opacity: 1;
}
</style>
