<script setup lang="ts">
import type { Component } from "vue";
import { css } from "styled-system/css";

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

const rootItemBase = css({
	display: 'flex',
	alignItems: 'center',
	fontSize: 'sm',
	fontWeight: 'medium',
	borderRadius: 'xl',
	transition: 'all',
	transitionDuration: '200ms',
	position: 'relative',
	border: '1px solid transparent',
	w: 'full',
});

const rootItemCollapsed = css({
	flexDir: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	textAlign: 'center',
	gap: '0.5',
	p: '2',
});

const rootItemExpanded = css({
	px: '3',
	py: '2.5',
});

const rootItemActiveCollapsed = css({
	bg: 'teal.500/10',
	color: 'teal.500',
});

const rootItemActiveExpanded = css({
	bgGradient: 'to-r',
	gradientFrom: 'teal.500/15',
	gradientTo: 'teal.500/5',
	color: 'teal.500',
	borderColor: 'teal.500/20',
});

const rootItemInactive = css({
	color: { base: 'gray.700', _dark: 'gray.300' },
	_hover: {
		bg: { base: 'rgba(255,255,255,0.6)', _dark: 'rgba(55,65,81,0.6)' },
		color: 'teal.500',
	},
});

const iconCollapsed = css({
	flexShrink: '0',
	transition: 'colors',
	transitionDuration: '200ms',
	w: '6',
	h: '6',
});

const iconExpanded = css({
	flexShrink: '0',
	transition: 'colors',
	transitionDuration: '200ms',
	w: '5',
	h: '5',
	mr: '3',
});

const iconActive = css({ color: 'teal.500' });
const iconInactive = css({ color: { base: 'gray.500', _dark: 'gray.400' } });

const labelStyle = css({
	transition: 'opacity',
	transitionDuration: '200ms',
});

const externalIconStyle = css({
	w: '3.5',
	h: '3.5',
	ml: 'auto',
	color: { base: 'gray.500', _dark: 'gray.400' },
});

const childrenListStyle = css({
	mt: '1',
	ml: '6',
	position: 'relative',
});

const childrenLineStyle = css({
	position: 'absolute',
	left: '0',
	top: '1',
	bottom: '1',
	w: '1px',
	bg: 'teal.500/30',
});

const nestedLineStyle = css({
	position: 'absolute',
	left: '0',
	top: '50%',
	w: '3',
	h: '1px',
	bg: 'teal.500/30',
});

const nestedLinkBase = css({
	display: 'flex',
	alignItems: 'center',
	fontWeight: 'medium',
	pl: '5',
	pr: '3',
	py: '1.5',
	transition: 'all',
	transitionDuration: '200ms',
});

const nestedLinkDepth1 = css({ fontSize: 'xs' });
const nestedLinkDeeper = css({ fontSize: '0.7rem' });

const nestedLinkActive = css({ color: 'teal.500' });
const nestedLinkInactive = css({
	color: { base: 'gray.500', _dark: 'gray.400' },
	_hover: { color: 'teal.500' },
});

const dotBase = css({
	borderRadius: 'full',
	mr: '2',
	transition: 'colors',
	transitionDuration: '200ms',
});

const dotDepth1 = css({ w: '1.5', h: '1.5' });
const dotDeeper = css({ w: '1', h: '1' });
const dotActive = css({ bg: 'teal.500' });
const dotInactive = css({ bg: { base: 'gray.500/50', _dark: 'gray.400/50' } });

const nestedChildrenList = css({
	ml: '5',
	position: 'relative',
});

const nestedChildrenLine = css({
	position: 'absolute',
	left: '0',
	top: '1',
	bottom: '1',
	w: '1px',
	bg: 'teal.500/20',
});

const relativeStyle = css({ position: 'relative' });
const hiddenStyle = css({ display: 'none' });
</script>

<template>
	<!-- Root level item (depth 0) -->
	<template v-if="depth === 0">
		<a
			:href="item.href"
			:target="item.external ? '_blank' : undefined"
			:rel="item.external ? 'noopener noreferrer' : undefined"
			:class="[
				rootItemBase,
				isCollapsed ? rootItemCollapsed : rootItemExpanded,
				isActive(item)
					? isCollapsed
						? rootItemActiveCollapsed
						: rootItemActiveExpanded
					: rootItemInactive,
			]"
			:aria-current="item.current ? 'page' : undefined"
			:title="isCollapsed ? item.name : undefined"
			@click="handleClick"
		>
			<component
				:is="item.icon"
				v-if="item.icon"
				:class="[
					isCollapsed ? iconCollapsed : iconExpanded,
					isActive(item) ? iconActive : iconInactive,
				]"
			/>
			<span
				:class="[
					labelStyle,
					isCollapsed ? hiddenStyle : '',
				]"
			>
				{{ item.name }}
			</span>
			<svg
				v-if="item.external && !isCollapsed"
				:class="externalIconStyle"
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
			:class="childrenListStyle"
		>
			<div :class="childrenLineStyle"></div>
			<li v-for="child in item.children" :key="child.href" :class="relativeStyle">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="1" />
			</li>
		</ul>
	</template>

	<!-- Nested items (depth > 0) - Expanded mode -->
	<template v-else-if="!isCollapsed">
		<div :class="nestedLineStyle" :style="{ opacity: 1 - depth * 0.2 }"></div>
		<a
			:href="item.href"
			:class="[
				nestedLinkBase,
				depth === 1 ? nestedLinkDepth1 : nestedLinkDeeper,
				isActive(item) ? nestedLinkActive : nestedLinkInactive,
			]"
			:aria-current="item.current ? 'page' : undefined"
		>
			<span
				:class="[
					dotBase,
					depth === 1 ? dotDepth1 : dotDeeper,
					isActive(item) ? dotActive : dotInactive,
				]"
			></span>
			{{ item.name }}
		</a>

		<!-- Nested children -->
		<ul
			v-if="shouldShowChildren(item)"
			:class="nestedChildrenList"
		>
			<div :class="nestedChildrenLine"></div>
			<li v-for="child in item.children" :key="child.href" :class="relativeStyle">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="depth + 1" />
			</li>
		</ul>
	</template>
</template>
