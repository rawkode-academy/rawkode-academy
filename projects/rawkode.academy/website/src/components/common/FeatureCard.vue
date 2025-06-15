<template>
  <div
    :class="[
      'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700',
      className
    ]"
  >
    <div class="flex items-center mb-4">
      <div
        v-if="$slots.icon"
        :class="[iconBgColor, 'p-3 rounded-full mr-4']"
      >
        <slot name="icon" />
      </div>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ title }}</h3>
    </div>
    <p class="text-gray-600 dark:text-gray-300">{{ description }}</p>
    <div v-if="$slots.footer" class="mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
	title: string;
	description: string;
	iconBgColor?: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	iconBgColor: "bg-primary/10",
	class: "",
});

const className = props.class;
</script>