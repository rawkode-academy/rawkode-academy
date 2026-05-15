<template>
	<input
		:type="type"
		:value="modelValue"
		:class="cx(classes, sizeClass, $attrs.class as string | undefined)"
		v-bind="restAttrs"
		@input="onInput"
	/>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { input } from "../../../styled-system/recipes";
import { css, cx } from "../../../styled-system/css";

type Size = "sm" | "md" | "lg";

const props = withDefaults(
	defineProps<{
		modelValue?: string | number;
		type?: string;
		size?: Size;
	}>(),
	{ type: "text", size: "md" },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

defineOptions({ inheritAttrs: false });

const sizePad: Record<Size, { h: string; px: string; fs: string }> = {
	sm: { h: "9", px: "3", fs: "sm" },
	md: { h: "10", px: "3", fs: "md" },
	lg: { h: "12", px: "4", fs: "lg" },
};

const sizeClass = computed(() => {
	const s = sizePad[props.size];
	return css({ h: s.h, px: s.px, fontSize: s.fs });
});

const classes = computed(() => input());

const onInput = (e: Event) => {
	emit("update:modelValue", (e.target as HTMLInputElement).value);
};

const attrs = useAttrs();
const restAttrs = computed(() => {
	const { class: _omit, ...rest } = attrs as Record<string, unknown> & { class?: unknown };
	return rest;
});
</script>
