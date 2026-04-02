<script setup lang="ts">
import type { Component } from "vue";

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

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
		return;
	}

	// Track external link clicks (like Discord)
	if (props.item.external) {
		const eventName = props.item.href.includes("rawkode.chat") || props.item.href.includes("discord")
			? "discord_link_clicked"
			: "external_link_clicked";
		trackEvent(eventName, {
			link_name: props.item.name,
			destination_url: props.item.href,
			source: "sidebar",
		});
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
				'group relative flex w-full items-center border transition-all duration-200 ease-out',
				isCollapsed
					? 'min-h-12 justify-center rounded-[1.2rem] px-0 py-2.5'
					: 'gap-3 rounded-[1.2rem] px-2.5 py-2',
				isActive(item)
					? 'border-primary/12 bg-white/72 text-slate-950 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.9)] dark:border-primary/30 dark:bg-slate-950/72 dark:text-white'
					: 'border-transparent text-slate-700 hover:border-white/45 hover:bg-white/48 hover:text-slate-950 dark:text-slate-300 dark:hover:border-white/8 dark:hover:bg-slate-950/50 dark:hover:text-white',
			]"
			:aria-current="item.current ? 'page' : undefined"
			:title="isCollapsed ? item.name : undefined"
			@click="handleClick"
		>
			<span
				class="absolute left-0 top-2 bottom-2 w-0.5 origin-center rounded-full bg-gradient-to-b from-primary via-primary to-secondary transition-all duration-200"
				:class="
					isActive(item)
						? 'opacity-100 scale-y-100'
						: 'opacity-0 scale-y-50 group-hover:opacity-50 group-hover:scale-y-100'
				"
			></span>

			<component
				:is="item.icon"
				v-if="item.icon"
				:class="[
					'relative z-10 shrink-0 rounded-[0.95rem] border p-2.5 transition-colors duration-200',
					isCollapsed ? 'h-10 w-10' : 'h-9 w-9',
					isActive(item)
						? 'border-primary/10 bg-primary/10 text-primary dark:border-primary/25 dark:bg-primary/12'
						: 'border-white/45 bg-white/52 text-slate-500 group-hover:border-primary/10 group-hover:bg-white/72 group-hover:text-primary dark:border-white/8 dark:bg-slate-950/44 dark:text-slate-400 dark:group-hover:border-primary/20 dark:group-hover:bg-slate-950/72 dark:group-hover:text-primary',
				]"
			/>

			<span v-if="!isCollapsed" class="relative z-10 min-w-0 flex-1">
				<span class="block truncate text-[0.92rem] font-medium leading-tight">
					{{ item.name }}
				</span>
			</span>
		</a>

		<ul
			v-if="shouldShowChildren(item) && !isCollapsed"
			class="relative mt-1 space-y-1 pl-3.5 before:pointer-events-none before:absolute before:left-1 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/28 before:via-primary/10 before:to-transparent"
		>
			<li v-for="child in item.children" :key="child.href" class="relative">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="1" />
			</li>
		</ul>
	</template>

	<template v-else-if="!isCollapsed">
		<a
			:href="item.href"
			:class="[
				'group relative flex items-center gap-2 rounded-xl py-1.5 pl-2.5 pr-2 transition-all duration-200',
				depth === 1 ? 'text-[0.8rem]' : 'text-[0.75rem]',
				isActive(item)
					? 'bg-primary/7 text-slate-950 dark:bg-primary/10 dark:text-white'
					: 'text-slate-600 hover:bg-white/44 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/44 dark:hover:text-white',
			]"
			:aria-current="item.current ? 'page' : undefined"
		>
			<span
				class="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-primary/30"
				:style="{ opacity: Math.max(0.35, 1 - depth * 0.18) }"
			></span>
			<span
				:class="[
					'ml-4 rounded-full transition-all duration-200',
					depth === 1 ? 'h-1.5 w-1.5' : 'h-1 w-1',
					isActive(item)
						? 'bg-primary shadow-[0_0_0_3px_rgba(4,181,156,0.1)]'
						: 'bg-slate-300 dark:bg-slate-600',
				]"
			></span>
			<span class="min-w-0 flex-1">
				<span class="block font-medium leading-5">{{ item.name }}</span>
			</span>
		</a>

		<ul
			v-if="shouldShowChildren(item)"
			class="relative ml-4 mt-1.5 space-y-1 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-primary/18"
		>
			<li v-for="child in item.children" :key="child.href" class="relative">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="depth + 1" />
			</li>
		</ul>
	</template>
</template>
