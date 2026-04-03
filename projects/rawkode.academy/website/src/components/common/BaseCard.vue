<template>
	<a :href="href" :class="['group block h-full', className]">
		<article
			class="flex h-full flex-col border-t border-black/10 pt-4 transition-colors duration-200 dark:border-white/10"
		>
			<div
				v-if="$slots.cover"
				class="relative overflow-hidden rounded-[1.4rem] bg-black/5 transition-transform duration-300 group-hover:-translate-y-0.5 dark:bg-white/5"
			>
				<slot name="cover" />
				<slot v-if="$slots.overlay" name="overlay" />
				<div v-if="$slots.badge" class="absolute top-3 left-3 z-20">
					<slot name="badge" />
				</div>
			</div>
			<div class="relative z-10 flex grow flex-col px-1 pt-5">
				<slot name="content" />
				<div v-if="$slots.footer" class="surface-divider mt-auto border-t pt-4">
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
