<script setup lang="ts">
import type { Component } from "vue";

export interface NavItemData {
	name: string;
	href: string;
	icon?: Component;
	current: boolean;
	external?: boolean;
	children?: NavItemData[];
}

interface Props {
	item: NavItemData;
	isCollapsed: boolean;
	depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
	depth: 0,
});

const emit = defineEmits<{
	(e: "expand"): void;
}>();

const hasCurrentChild = (item: NavItemData): boolean => {
	if (!item.children) return false;
	return item.children.some((child) => child.current || hasCurrentChild(child));
};

const isActive = (item: NavItemData): boolean => {
	return item.current || hasCurrentChild(item);
};

const shouldShowChildren = (item: NavItemData): boolean => {
	return !!(item.children?.length && isActive(item));
};

const handleClick = (e: Event) => {
	if (props.isCollapsed) {
		e.preventDefault();
		emit("expand");
	}
};
</script>

<template>
	<!-- Root level item (depth 0) -->
	<template v-if="depth === 0">
		<a
			:href="item.href"
			:target="item.external ? '_blank' : undefined"
			:rel="item.external ? 'noopener noreferrer' : undefined"
			:class="[
				'flex items-center text-sm font-medium rounded-xl transition-all duration-200',
				'group relative border border-transparent w-full',
				isCollapsed
					? 'flex-col items-center justify-center text-center gap-0.5 p-2'
					: 'px-3 py-2.5',
				isActive(item)
					? isCollapsed
						? 'bg-primary/10 text-primary'
						: 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/20'
					: 'text-secondary-content hover:bg-white/60 dark:hover:bg-gray-700/60 hover:text-primary',
			]"
			:aria-current="item.current ? 'page' : undefined"
			:title="isCollapsed ? item.name : undefined"
			@click="handleClick"
		>
			<component
				:is="item.icon"
				v-if="item.icon"
				:class="[
					'flex-shrink-0 transition-colors',
					isCollapsed ? 'w-6 h-6' : 'w-5 h-5 mr-3',
					isActive(item) ? 'text-primary' : 'text-muted group-hover:text-primary',
				]"
			/>
			<span
				:class="[
					'transition-opacity duration-200',
					isCollapsed
						? 'hidden'
						: '',
				]"
			>
				{{ item.name }}
			</span>
			<svg
				v-if="item.external && !isCollapsed"
				class="w-3.5 h-3.5 ml-auto text-muted group-hover:text-primary"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
			</svg>
		</a>

		<!-- Children - Expanded mode -->
		<ul
			v-if="shouldShowChildren(item) && !isCollapsed"
			class="mt-1 ml-6 relative"
		>
			<div class="absolute left-0 top-1 bottom-1 w-px bg-primary/30"></div>
			<li v-for="child in item.children" :key="child.href" class="relative">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="1" />
			</li>
		</ul>
	</template>

	<!-- Nested items (depth > 0) - Expanded mode -->
	<template v-else-if="!isCollapsed">
		<div class="absolute left-0 top-1/2 w-3 h-px bg-primary/30" :style="{ opacity: 1 - depth * 0.2 }"></div>
		<a
			:href="item.href"
			:class="[
				'flex items-center font-medium pl-5 pr-3 py-1.5 transition-all duration-200',
				depth === 1 ? 'text-xs' : 'text-[0.7rem]',
				isActive(item) ? 'text-primary' : 'text-muted hover:text-primary',
			]"
			:aria-current="item.current ? 'page' : undefined"
		>
			<span
				:class="[
					'rounded-full mr-2 transition-colors',
					depth === 1 ? 'w-1.5 h-1.5' : 'w-1 h-1',
					isActive(item) ? 'bg-primary' : 'bg-muted/50',
				]"
			></span>
			{{ item.name }}
		</a>

		<!-- Nested children -->
		<ul
			v-if="shouldShowChildren(item)"
			class="ml-5 relative"
		>
			<div class="absolute left-0 top-1 bottom-1 w-px bg-primary/20"></div>
			<li v-for="child in item.children" :key="child.href" class="relative">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="depth + 1" />
			</li>
		</ul>
	</template>
</template>