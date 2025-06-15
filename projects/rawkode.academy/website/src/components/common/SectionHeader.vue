<template>
  <div :class="['flex items-center mb-8', className]">
    <div class="h-10 w-1 bg-gradient-to-b from-primary to-secondary rounded-full mr-3"></div>
    <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
      {{ title }}
    </h2>
    <div
      v-if="showSeparator"
      class="ml-4 h-px grow bg-gradient-to-r from-primary/30 to-transparent"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
	title: string;
	showSeparator?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	showSeparator: true,
	class: "",
});

const className = props.class;
</script>

<style scoped>
.bg-gradient-to-b {
  background-image: linear-gradient(to bottom, var(--primary), var(--secondary));
}

.bg-gradient-to-r {
  background-image: linear-gradient(to right, var(--primary), transparent);
}
</style>