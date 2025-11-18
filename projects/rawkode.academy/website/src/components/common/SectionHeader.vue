<template>
  <div :class="[wrapperClasses, className]">
    <div class="h-10 w-1 bg-gradient-to-b from-primary to-secondary rounded-full"></div>
    <div :class="textClasses">
      <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="text-base text-gray-600 dark:text-gray-300 mt-2 max-w-2xl"
      >
        {{ subtitle }}
      </p>
    </div>
    <div
      v-if="showSeparator"
      class="ml-4 h-px grow bg-gradient-to-r from-primary/30 to-transparent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

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
const wrapperClasses = computed(() => [
	"flex items-start gap-3 mb-8",
	props.centered ? "justify-center text-center" : "",
]);
const textClasses = computed(() => [
	"flex flex-col",
	props.centered ? "items-center text-center" : "",
]);
const subtitle = props.subtitle;
const showSeparator = props.showSeparator;
const title = props.title;
</script>

<style scoped>
.bg-gradient-to-b {
  background-image: linear-gradient(to bottom, var(--primary), var(--secondary));
}

.bg-gradient-to-r {
  background-image: linear-gradient(to right, var(--primary), transparent);
}
</style>
