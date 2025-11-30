<template>
  <div
    :class="[
      'glass-card-shimmer card-shadow card-hover p-6',
      className
    ]"
  >
    <div class="flex items-center mb-4 relative z-10">
      <div
        v-if="$slots.icon"
        :class="[iconBgColor, 'p-3 rounded-full mr-4']"
      >
        <slot name="icon" />
      </div>
      <h3 class="text-lg font-bold text-primary-content">{{ title }}</h3>
    </div>
    <p class="text-secondary-content relative z-10">{{ description }}</p>
    <div v-if="$slots.footer" class="mt-4 relative z-10">
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
