<script setup lang="ts">
defineProps<{
	iconUrl: string;
	revealed: boolean;
}>();
</script>

<template>
	<div class="gtl-logo-card" :class="{ revealed }">
		<div class="gtl-logo-scanlines">
			<div class="gtl-logo-mask-cyan" :style="`--icon-url: url(${iconUrl})`"></div>
			<div class="gtl-logo-mask-purple" :style="`--icon-url: url(${iconUrl})`"></div>
		</div>
		<img :src="iconUrl" alt="" class="gtl-logo-img" loading="lazy" aria-hidden="true" />
	</div>
</template>

<style scoped>
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

.gtl-logo-scanlines {
	position: absolute;
	inset: 1.25rem;
	mask-image: repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 4px);
	-webkit-mask-image: repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 4px);
	mask-size: 100% 4px;
	-webkit-mask-size: 100% 4px;
	animation: scanline-scroll 1s linear infinite;
	transition: opacity 350ms ease;
}

.gtl-logo-card.revealed .gtl-logo-scanlines {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.gtl-logo-scanlines {
		animation: none;
	}
}

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
