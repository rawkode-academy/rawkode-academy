<template>
	<Avatar.Root :class="cx(classes.root, sizeClass)">
		<Avatar.Fallback :class="classes.fallback">{{ initials }}</Avatar.Fallback>
		<Avatar.Image v-if="src" :src="src" :alt="alt" :class="classes.image" />
	</Avatar.Root>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Avatar } from "@ark-ui/vue/avatar";
import { avatar } from "../../../styled-system/recipes";
import { css, cx } from "../../../styled-system/css";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const props = withDefaults(
	defineProps<{
		src?: string;
		alt?: string;
		name?: string;
		size?: Size;
	}>(),
	{ size: "md", alt: "" },
);

const initials = computed(() => {
	if (!props.name) return "";
	return props.name
		.split(/\s+/)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
});

const sizeMap: Record<Size, string> = {
	xs: "1.5rem",
	sm: "2rem",
	md: "2.5rem",
	lg: "3rem",
	xl: "4rem",
	"2xl": "5rem",
};

const sizeClass = computed(() =>
	css({
		width: sizeMap[props.size],
		height: sizeMap[props.size],
		fontSize: props.size === "xs" ? "xs" : props.size === "sm" ? "sm" : "md",
	}),
);

const classes = computed(() => avatar());
</script>
