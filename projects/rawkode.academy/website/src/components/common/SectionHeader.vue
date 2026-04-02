<template>
  <div :class="cx(wrapperClasses, className)">
    <div
      :class="css({
        height: '10',
        width: '1',
        backgroundImage: 'linear-gradient(to bottom, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))',
        borderRadius: 'full',
      })"
    ></div>
    <div :class="textClasses">
      <h2
        :class="css({
          fontSize: { base: '2xl', md: '3xl' },
          fontWeight: 'bold',
          color: 'fg.default',
        })"
      >
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        :class="css({
          fontSize: 'base',
          color: 'fg.subtle',
          mt: '2',
          maxWidth: '2xl',
        })"
      >
        {{ subtitle }}
      </p>
    </div>
    <div
      v-if="showSeparator"
      :class="css({
        ml: '4',
        height: '1px',
        flexGrow: 1,
        backgroundImage: 'linear-gradient(to right, rgb(var(--brand-primary) / 0.3), transparent)',
      })"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

interface Props {
	title: string;
	subtitle?: string;
	showSeparator?: boolean;
	centered?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	showSeparator: true,
	centered: false,
	class: "",
});

const className = props.class;

const wrapperClasses = computed(() =>
	css({
		display: "flex",
		alignItems: "flex-start",
		gap: "3",
		mb: "8",
		...(props.centered ? { justifyContent: "center", textAlign: "center" } : {}),
	}),
);

const textClasses = computed(() =>
	css({
		display: "flex",
		flexDirection: "column",
		...(props.centered ? { alignItems: "center", textAlign: "center" } : {}),
	}),
);
</script>
