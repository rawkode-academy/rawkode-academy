<script setup lang="ts">
import type { FunctionalComponent, HTMLAttributes, VNodeProps } from 'vue';

const props = defineProps<{
	menuItems: {
		name: string,
		href: string,
		icon: FunctionalComponent<HTMLAttributes & VNodeProps, {}, any>,
		current: boolean
	}[]
}>();

</script>

<template>
	<li v-for="item in props.menuItems" :key="item.name">
		<a :href="item.href"
			class="flex items-center p-2 text-base font-medium text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
			<component :is="item.icon"
				:class="[item.current ? 'text-primary-600' : '', 'w-6 h-6 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white']"
				aria-hidden="true" />

			<span :class="[item.current ? 'text-primary-600' : '', 'ml-3']">{{ item.name }}</span>
		</a>
	</li>
</template>
