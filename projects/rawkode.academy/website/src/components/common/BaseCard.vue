<template>
	<a :href="href" :class="['group base-card', className]">
		<article class="base-card__article">
			<div v-if="$slots.cover" class="base-card__cover">
				<slot name="cover" />
				<slot v-if="$slots.overlay" name="overlay" />
				<div v-if="$slots.badge" class="base-card__badge">
					<slot name="badge" />
				</div>
			</div>
			<div class="base-card__body">
				<slot name="content" />
				<div v-if="$slots.footer" class="base-card__footer">
					<slot name="footer" />
				</div>
			</div>
		</article>
	</a>
</template>

<script setup lang="ts">
interface Props {
	href: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	class: "",
});

const className = props.class;
</script>

<style scoped>
/* Editorial card surface: top hairline that thickens on hover (no scale, no shadow). */
.base-card {
	display: block;
	height: 100%;
	color: inherit;
	text-decoration: none;
	position: relative;
}

.base-card__article {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding-top: 1rem;
	border-top: 1px solid var(--editorial-hairline);
	transition: border-color var(--duration-base) var(--ease-standard);
	position: relative;
}

.base-card__article::before {
	content: "";
	position: absolute;
	top: -1px;
	left: 0;
	right: 0;
	height: 2px;
	background: var(--editorial-ink);
	opacity: 0;
	transition: opacity var(--duration-base) var(--ease-standard);
	pointer-events: none;
}

.base-card:hover .base-card__article::before { opacity: 1; }

.base-card__cover {
	position: relative;
	overflow: hidden;
	background: var(--editorial-paper-deep);
	border: 1px solid var(--editorial-hairline);
	aspect-ratio: 16 / 10;
}

.base-card__cover :deep(img),
.base-card__cover :deep(svg) {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.base-card__badge {
	position: absolute;
	top: 0.75rem;
	left: 0.75rem;
	z-index: 20;
}

.base-card__body {
	position: relative;
	z-index: 10;
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	padding: 1.25rem 0.25rem 0;
}

.base-card__footer {
	margin-top: auto;
	padding-top: 1rem;
	border-top: 1px solid var(--editorial-hairline);
}
</style>
