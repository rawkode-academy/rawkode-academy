<script setup lang="ts">
import type { FunctionalComponent, HTMLAttributes, VNodeProps } from "vue";

const props = defineProps<{
	menuItems: {
		name: string;
		href: string;
		target?: string;
		icon: FunctionalComponent<HTMLAttributes & VNodeProps, {}, any>;
		current: boolean;
	}[];
}>();
</script>

<template>
	<li v-for="item in props.menuItems" :key="item.name">
		<a :href="item.href" :target="item.target || '_self'"
			:class="[
				'flex items-center p-2.5 text-base font-medium rounded-lg transition-all duration-200 ease-in-out relative overflow-hidden group',
				item.current 
					? 'bg-primary/10 dark:bg-primary/30 pl-4 pr-1 text-primary dark:text-white font-semibold' 
					: 'text-gray-900 dark:text-white hover:pl-4 hover:pr-1 hover:bg-primary/10 dark:hover:bg-primary/30'
			]">
			
			<!-- Background hover/active effect -->
			<div 
				:class="[
					'absolute inset-0 transform transition-transform duration-300 ease-out',
					item.current 
						? 'bg-primary/5 dark:bg-primary/20' 
						: 'bg-primary/0 group-hover:bg-primary/5 dark:group-hover:bg-primary/20 translate-x-full group-hover:translate-x-0'
				]">
			</div>
			
			<!-- Left border indicator for active item -->
			<div 
				v-if="item.current" 
				class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary">
			</div>
			
			<component :is="item.icon"
				:class="[
					item.current ? 'text-primary dark:text-white scale-110' : 'text-gray-500 dark:text-gray-400 group-hover:scale-110 group-hover:text-primary dark:group-hover:text-white',
					'w-5 h-5 transition-all duration-200 ease-in-out transform z-10'
				]"
				aria-hidden="true" />

			<span :class="[
				item.current ? 'text-primary dark:text-white font-semibold' : 'group-hover:text-primary dark:group-hover:text-white',
				'ml-3 z-10 transition-all duration-200 ease-in-out'
			]">{{ item.name }}</span>
			
			<!-- Right arrow that appears on hover or when active -->
			<svg 
				xmlns="http://www.w3.org/2000/svg" 
				:class="[
					'h-4 w-4 ml-auto text-primary dark:text-white transition-all duration-300 ease-in-out z-10',
					item.current 
						? 'opacity-100 translate-x-0' 
						: 'opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'
				]" 
				fill="none" 
				viewBox="0 0 24 24" 
				stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</a>
	</li>
</template>