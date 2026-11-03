<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
defineProps<{
	iconUrl: string;
	revealed: boolean;
}>();
</script>

<template>
	<div class="gtl-logo-card" :class="[gameTheme.root, { revealed }]">
		<!--
			Homepage Hero technique: the logo is cut into scanlines by a
			repeating-gradient mask on its container, so the lines are the logo
			itself rather than a stripe overlay painted across the card.
		-->
		<div class="gtl-logo-scanlines" aria-hidden="true">
			<img :src="iconUrl" alt="" class="gtl-logo-mono" decoding="async" />
			<div class="gtl-logo-tint" :style="`--icon-url: url(${iconUrl})`"></div>
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
/* Seamless scroll: move the scanline mask by exactly one period (4px). */
@keyframes scanline-scroll {
	from {
		mask-position: 0 0;
		-webkit-mask-position: 0 0;
	}
	to {
		mask-position: 0 4px;
		-webkit-mask-position: 0 4px;
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
	background: color-mix(in srgb, var(--colors-academy-status-violet) 5%, transparent);
	border: 1px solid var(--colors-academy-border);
	overflow: hidden;
	transition: border-color 250ms ease, background 250ms ease;
}

.gtl-logo-card::before {
	content: "";
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, color-mix(in srgb, var(--colors-academy-accent-foreground) 4%, transparent), transparent 60%);
	pointer-events: none;
}

/*
 * Scanline mask (2px on / 2px off, 4px period), sized to the padded content
 * area. Everything inside renders only on the "on" rows. `isolation` keeps the
 * tint's blend inside this layer.
 */
.gtl-logo-scanlines {
	position: absolute;
	inset: 1.25rem;
	isolation: isolate;
	mask-image: repeating-linear-gradient(
		to bottom,
		black 0px,
		black 2px,
		transparent 2px,
		transparent 4px
	);
	-webkit-mask-image: repeating-linear-gradient(
		to bottom,
		black 0px,
		black 2px,
		transparent 2px,
		transparent 4px
	);
	mask-size: 100% 4px;
	-webkit-mask-size: 100% 4px;
	animation: scanline-scroll 1s linear infinite;
	transition: opacity 350ms ease;
}

/*
 * Boosted greyscale: the logo's own brightness supplies the detail. Contrast
 * is clamped so dark logos never drop to black and bright ones never blow
 * out to white, then shifted lighter on dark surfaces and darker on light.
 */
.gtl-logo-mono {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: contain;
	filter: grayscale(1) contrast(0.55) brightness(0.8);
}

html.dark .gtl-logo-mono {
	filter: grayscale(1) contrast(0.55) brightness(1.25);
}

/* Violet tint: takes hue from the token, keeps the greyscale's brightness */
.gtl-logo-tint {
	position: absolute;
	inset: 0;
	background-color: var(--colors-academy-status-violet);
	mix-blend-mode: color;
	mask-image: var(--icon-url);
	-webkit-mask-image: var(--icon-url);
	mask-repeat: no-repeat;
	-webkit-mask-repeat: no-repeat;
	mask-position: center;
	-webkit-mask-position: center;
	mask-size: contain;
	-webkit-mask-size: contain;
}

/* Hide the scanline logo (and show the full-colour image) when revealed */
.gtl-logo-card.revealed .gtl-logo-scanlines {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.gtl-logo-scanlines {
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
