<script setup lang="ts">
import { computed, type Component } from "vue";
import { css } from "../../../styled-system/css";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as unknown as { posthog?: { capture: (e: string, p?: unknown) => void } }).posthog?.capture(event, properties);
	} catch {
		// ignore
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
	return item.children.some((c) => c.current || hasCurrentChild(c));
};
const isActive = (item: NavItemData): boolean => item.current || hasCurrentChild(item);
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
			props.item.href.includes("rawkode.chat") || props.item.href.includes("discord")
				? "discord_link_clicked"
				: "external_link_clicked";
		trackEvent(eventName, {
			link_name: props.item.name,
			destination_url: props.item.href,
			source: "sidebar",
		});
	}
};

const rootLinkClass = computed(() =>
	css({
		position: "relative",
		display: "flex",
		alignItems: "center",
		gap: props.isCollapsed ? "0" : "3",
		w: "full",
		px: props.isCollapsed ? "0" : "2.5",
		py: "2",
		minH: "10",
		justifyContent: props.isCollapsed ? "center" : "flex-start",
		borderRadius: "xl",
		borderWidth: "1px",
		borderColor: "transparent",
		color: "fg.secondary",
		textDecoration: "none",
		transition: "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
		_hover: { bg: "bg.sunken", color: "fg.primary", borderColor: "border.muted" },
		"&[data-active='true']": {
			bg: "bg.brand-subtle",
			color: "fg.brand",
			borderColor: "border.default",
		},
	}),
);

const railClass = computed(() =>
	css({
		position: "absolute",
		left: "0",
		top: "2",
		bottom: "2",
		width: "2px",
		borderRadius: "full",
		transition: "opacity 200ms ease",
		backgroundImage: "linear-gradient(to bottom, token(colors.brand.500), token(colors.cyan.500))",
		opacity: "0",
		"&[data-active='true']": { opacity: "1" },
	}),
);

const iconClass = computed(() =>
	css({
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
		borderRadius: "lg",
		borderWidth: "1px",
		borderColor: "border.muted",
		bg: "bg.surface",
		color: "fg.muted",
		width: props.isCollapsed ? "10" : "9",
		height: props.isCollapsed ? "10" : "9",
		p: "2",
		transition: "all 200ms ease",
		"& svg": { width: "full", height: "full" },
		"a[data-active='true'] &": {
			bg: "bg.brand-subtle",
			borderColor: "border.default",
			color: "fg.brand",
		},
		"a:hover &": { color: "fg.brand" },
	}),
);

const labelClass = css({
	flex: "1",
	minW: "0",
	fontSize: "sm",
	fontWeight: "medium",
	lineHeight: "tight",
	truncate: true,
});

const subListClass = css({
	position: "relative",
	mt: "1",
	pl: "3.5",
	display: "flex",
	flexDirection: "column",
	gap: "1",
	_before: {
		content: '""',
		position: "absolute",
		left: "1",
		top: "2",
		bottom: "2",
		width: "1px",
		bg: "border.muted",
	},
});

const childLinkClass = computed(() =>
	css({
		position: "relative",
		display: "flex",
		alignItems: "center",
		gap: "2",
		py: "1.5",
		pl: "4",
		pr: "2",
		borderRadius: "md",
		fontSize: props.depth === 1 ? "sm" : "xs",
		color: "fg.secondary",
		textDecoration: "none",
		transition: "color 200ms ease, background-color 200ms ease",
		_hover: { bg: "bg.sunken", color: "fg.primary" },
		"&[data-active='true']": { color: "fg.brand", bg: "bg.brand-subtle" },
	}),
);

const childDotClass = computed(() =>
	css({
		width: props.depth === 1 ? "1.5" : "1",
		height: props.depth === 1 ? "1.5" : "1",
		borderRadius: "full",
		bg: "border.default",
		"a[data-active='true'] &": { bg: "fg.brand" },
	}),
);
</script>

<template>
	<template v-if="depth === 0">
		<a
			:href="item.href"
			:target="item.external ? '_blank' : undefined"
			:rel="item.external ? 'noopener noreferrer' : undefined"
			:class="rootLinkClass"
			:data-active="isActive(item) ? 'true' : 'false'"
			:aria-current="item.current ? 'page' : undefined"
			:title="isCollapsed ? item.name : undefined"
			@click="handleClick"
		>
			<span :class="railClass" :data-active="isActive(item) ? 'true' : 'false'" aria-hidden="true"></span>
			<span :class="iconClass" v-if="item.icon">
				<component :is="item.icon" />
			</span>
			<span v-if="!isCollapsed" :class="labelClass">{{ item.name }}</span>
		</a>

		<ul v-if="shouldShowChildren(item) && !isCollapsed" :class="subListClass">
			<li v-for="child in item.children" :key="child.href">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="1" />
			</li>
		</ul>
	</template>

	<template v-else-if="!isCollapsed">
		<a
			:href="item.href"
			:class="childLinkClass"
			:data-active="isActive(item) ? 'true' : 'false'"
			:aria-current="item.current ? 'page' : undefined"
		>
			<span :class="childDotClass" aria-hidden="true"></span>
			<span style="flex: 1; min-width: 0;">{{ item.name }}</span>
		</a>
		<ul v-if="shouldShowChildren(item)" :class="subListClass" style="margin-left: 1rem;">
			<li v-for="child in item.children" :key="child.href">
				<NavItem :item="child" :isCollapsed="isCollapsed" :depth="depth + 1" />
			</li>
		</ul>
	</template>
</template>
