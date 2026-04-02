<script setup lang="ts">
import { ref } from "vue";
import { AccordionRoot, AccordionItem, AccordionItemTrigger, AccordionItemContent, AccordionItemIndicator } from "@ark-ui/vue/accordion";
import { css } from "../../../styled-system/css";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface AccordionItemData {
	id: string;
	question: string;
	answer?: string;
}

interface Props {
	items: AccordionItemData[];
	defaultOpenId?: string;
}

const props = defineProps<Props>();

const expandedValues = ref<string[]>(
	props.defaultOpenId ? [props.defaultOpenId] : [],
);

const handleValueChange = (details: { value: string[] }) => {
	const previousValues = expandedValues.value;
	expandedValues.value = details.value;

	const newlyExpanded = details.value.filter((v) => !previousValues.includes(v));
	const newlyCollapsed = previousValues.filter((v) => !details.value.includes(v));

	for (const id of newlyExpanded) {
		trackEvent("accordion_toggled", { item_id: id, action: "expanded" });
	}
	for (const id of newlyCollapsed) {
		trackEvent("accordion_toggled", { item_id: id, action: "collapsed" });
	}
};

const rootStyles = css({ w: "full" });

const triggerStyles = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	py: "5",
	px: "4",
	w: "full",
	fontWeight: "medium",
	textAlign: "left",
	borderBottomWidth: "1px",
	borderColor: "border.subtle",
	transition: "all",
	transitionDuration: "200ms",
	borderTopRadius: "xl",
	cursor: "pointer",
	_hover: {
		bg: { base: "rgba(255,255,255,0.4)", _dark: "rgba(31,41,55,0.4)" },
		backdropFilter: "blur(12px)",
	},
});

const triggerOpenStyles = css({
	color: { base: "gray.900", _dark: "white" },
	bg: { base: "rgba(255,255,255,0.3)", _dark: "rgba(31,41,55,0.3)" },
	backdropFilter: "blur(12px)",
});

const triggerClosedStyles = css({
	color: { base: "gray.500", _dark: "gray.400" },
});

const indicatorStyles = css({
	transition: "transform",
	transitionDuration: "200ms",
	flexShrink: "0",
	"& svg": {
		w: "6",
		h: "6",
	},
	_open: {
		transform: "rotate(180deg)",
	},
});

const contentStyles = css({
	overflow: "hidden",
});

const contentInnerStyles = css({
	py: "5",
	px: "4",
	borderBottomWidth: "1px",
	borderColor: "border.subtle",
	bg: { base: "rgba(255,255,255,0.2)", _dark: "rgba(31,41,55,0.2)" },
	backdropFilter: "blur(4px)",
	color: { base: "gray.600", _dark: "gray.300" },
});
</script>

<template>
	<AccordionRoot
		:class="rootStyles"
		multiple
		collapsible
		:model-value="expandedValues"
		@value-change="handleValueChange"
	>
		<AccordionItem
			v-for="item in items"
			:key="item.id"
			:value="item.id"
		>
			<AccordionItemTrigger
				:class="[triggerStyles, expandedValues.includes(item.id) ? triggerOpenStyles : triggerClosedStyles]"
			>
				<span>{{ item.question }}</span>
				<AccordionItemIndicator :class="indicatorStyles">
					<svg
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						></path>
					</svg>
				</AccordionItemIndicator>
			</AccordionItemTrigger>
			<AccordionItemContent :class="contentStyles">
				<div :class="contentInnerStyles">
					<slot :name="`answer-${item.id}`">
						{{ item.answer }}
					</slot>
				</div>
			</AccordionItemContent>
		</AccordionItem>
	</AccordionRoot>
</template>
