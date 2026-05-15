<template>
	<Dialog.Root v-model:open="modelOpen">
		<Dialog.Trigger v-if="$slots.trigger" as-child>
			<slot name="trigger" />
		</Dialog.Trigger>
		<Teleport to="body">
			<Dialog.Backdrop :class="classes.backdrop" />
			<Dialog.Positioner :class="classes.positioner">
				<Dialog.Content :class="cx(classes.content, contentClass)">
					<Dialog.Title v-if="title || $slots.title" :class="classes.title">
						<slot name="title">{{ title }}</slot>
					</Dialog.Title>
					<Dialog.Description v-if="description || $slots.description" :class="classes.description">
						<slot name="description">{{ description }}</slot>
					</Dialog.Description>
					<slot />
					<Dialog.CloseTrigger v-if="!hideCloseButton" :class="cx(classes.closeTrigger, closeBtnClass)" aria-label="Close">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</Dialog.CloseTrigger>
				</Dialog.Content>
			</Dialog.Positioner>
		</Teleport>
	</Dialog.Root>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Dialog } from "@ark-ui/vue/dialog";
import { dialog } from "../../../styled-system/recipes";
import { css, cx } from "../../../styled-system/css";

const props = withDefaults(
	defineProps<{
		open?: boolean;
		title?: string;
		description?: string;
		size?: "sm" | "md" | "lg" | "xl";
		hideCloseButton?: boolean;
	}>(),
	{ size: "md", hideCloseButton: false },
);
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const modelOpen = computed({
	get: () => props.open,
	set: (v) => emit("update:open", v ?? false),
});

const sizeMap = { sm: "24rem", md: "32rem", lg: "48rem", xl: "64rem" } as const;

const contentClass = computed(() =>
	css({ maxWidth: sizeMap[props.size], width: "calc(100% - 2rem)" }),
);

const closeBtnClass = css({
	position: "absolute",
	top: "3",
	right: "3",
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "8",
	height: "8",
	borderRadius: "md",
	color: "fg.muted",
	_hover: { bg: "bg.sunken", color: "fg.primary" },
});

const classes = computed(() => dialog());
</script>
