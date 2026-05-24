<script setup lang="ts">
import type { Component } from "vue";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as { posthog?: { capture: (e: string, p?: unknown) => void } }).posthog?.capture(event, properties);
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

const props = withDefaults(defineProps<Props>(), { depth: 0 });

const emit = defineEmits<{ (e: "expand"): void }>();

const hasCurrentChild = (item: NavItemData): boolean => {
	if (!item.children) return false;
	return item.children.some((child) => child.current || hasCurrentChild(child));
};

const isActive = (item: NavItemData): boolean =>
	item.current || hasCurrentChild(item);

const shouldShowChildren = (item: NavItemData): boolean =>
	!!(item.children?.length && isActive(item));

const handleClick = (e: Event) => {
	if (props.isCollapsed) {
		e.preventDefault();
		emit("expand");
		return;
	}

	if (props.item.external) {
		const eventName =
			props.item.href.includes("rawkode.chat") ||
			props.item.href.includes("discord")
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
				'ed-nav-item',
				isCollapsed ? 'ed-nav-item--collapsed' : 'ed-nav-item--expanded',
				isActive(item) && 'ed-nav-item--active',
			]"
			:aria-current="item.current ? 'page' : undefined"
			:title="isCollapsed ? item.name : undefined"
			@click="handleClick"
		>
			<span class="ed-nav-item__rail" aria-hidden="true"></span>
			<component
				:is="item.icon"
				v-if="item.icon"
				class="ed-nav-item__icon"
				aria-hidden="true"
			/>
			<span v-if="!isCollapsed" class="ed-nav-item__label">{{ item.name }}</span>
		</a>

		<ul
			v-if="shouldShowChildren(item) && !isCollapsed"
			class="ed-nav-sublist"
		>
			<li v-for="child in item.children" :key="child.href">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="1" />
			</li>
		</ul>
	</template>

	<template v-else-if="!isCollapsed">
		<a
			:href="item.href"
			:class="[
				'ed-nav-subitem',
				isActive(item) && 'ed-nav-subitem--active',
				depth === 1 ? 'ed-nav-subitem--d1' : 'ed-nav-subitem--d2',
			]"
			:aria-current="item.current ? 'page' : undefined"
		>
			<span class="ed-nav-subitem__hairline" aria-hidden="true"></span>
			<span class="ed-nav-subitem__label">{{ item.name }}</span>
		</a>

		<ul v-if="shouldShowChildren(item)" class="ed-nav-sublist ed-nav-sublist--nested">
			<li v-for="child in item.children" :key="child.href">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="depth + 1" />
			</li>
		</ul>
	</template>
</template>

<style scoped>
/* Root nav item — flat row with left ink rail on active. */
.ed-nav-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	width: 100%;
	padding: 0.625rem 1rem;
	color: var(--editorial-ink-soft);
	text-decoration: none;
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.9rem;
	font-weight: 500;
	position: relative;
	border-left: 2px solid transparent;
	transition: color var(--duration-base) var(--ease-standard),
		background-color var(--duration-base) var(--ease-standard),
		border-color var(--duration-base) var(--ease-standard);
}

.ed-nav-item--collapsed {
	justify-content: center;
	padding: 0.75rem 0;
}

.ed-nav-item:hover {
	color: var(--editorial-ink);
	background: var(--surface-card-muted);
}

.ed-nav-item--active {
	color: var(--editorial-ink);
	background: var(--surface-card-muted);
	border-left-color: var(--editorial-ink);
}

.ed-nav-item__rail { display: none; }

.ed-nav-item__icon {
	width: 18px;
	height: 18px;
	flex-shrink: 0;
	stroke-width: 1.6;
}

.ed-nav-item__label {
	min-width: 0;
	flex: 1;
	line-height: 1.3;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ed-nav-item:focus-visible {
	outline: 2px solid var(--editorial-ink);
	outline-offset: -2px;
}

/* Sublists — indented with a left hairline rail. */
.ed-nav-sublist {
	list-style: none;
	margin: 0;
	padding: 0.25rem 0 0.5rem 1rem;
	position: relative;
}

.ed-nav-sublist::before {
	content: "";
	position: absolute;
	left: 1rem;
	top: 0.25rem;
	bottom: 0.5rem;
	width: 1px;
	background: var(--editorial-hairline);
}

.ed-nav-sublist--nested {
	padding-left: 0.75rem;
}

.ed-nav-subitem {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	padding: 0.4rem 0.75rem 0.4rem 1.25rem;
	color: var(--editorial-ink-mute);
	text-decoration: none;
	font-family: var(--font-inter-tight), sans-serif;
	line-height: 1.3;
	position: relative;
	transition: color var(--duration-base) var(--ease-standard);
}

.ed-nav-subitem--d1 { font-size: 0.82rem; }
.ed-nav-subitem--d2 { font-size: 0.78rem; padding-left: 1.5rem; }

.ed-nav-subitem__hairline {
	position: absolute;
	left: 0.5rem;
	top: 50%;
	width: 0.6rem;
	height: 1px;
	background: var(--editorial-hairline-strong);
}

.ed-nav-subitem:hover {
	color: var(--editorial-ink);
}

.ed-nav-subitem--active {
	color: var(--editorial-ink);
	font-weight: 500;
}

.ed-nav-subitem--active .ed-nav-subitem__hairline {
	background: var(--editorial-ink);
	width: 0.8rem;
}

.ed-nav-subitem:focus-visible {
	outline: 2px solid var(--editorial-ink);
	outline-offset: -2px;
}
</style>
