<template>
  <section :class="['relative py-16 overflow-hidden', className]">
    <div
      :class="[
        'absolute inset-0 bg-gradient-to-br',
        gradientFrom,
        gradientVia,
        gradientTo,
        'dark:from-gray-900 dark:via-gray-800 dark:to-gray-900'
      ]"
    >
      <slot v-if="$slots.background" name="background" />
    </div>
    <div class="relative z-10 container mx-auto px-4">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
	gradientFrom?: string;
	gradientVia?: string;
	gradientTo?: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	gradientFrom: "from-primary/5",
	gradientVia: "via-gray-50",
	gradientTo: "to-secondary/5",
	class: "",
});

const className = props.class;
</script>