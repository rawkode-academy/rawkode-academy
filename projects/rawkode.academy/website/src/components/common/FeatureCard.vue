<template>
  <div
    :class="[
      'bg-white/40 dark:bg-gray-800/60 backdrop-blur-2xl p-6 rounded-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] border border-white/40 dark:border-gray-600/50 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-700/70 hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.18)] dark:hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.7)] hover:scale-[1.02]',
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
    <p class="text-gray-600 dark:text-gray-200">{{ description }}</p>
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