<template>
  <a :href="href" :class="['h-full', className]">
    <article
      class="p-0 bg-white rounded-xl overflow-hidden shadow-lg dark:bg-gray-800 dark:border-gray-700 h-full flex flex-col transition-all duration-300 border border-gray-100 dark:border-gray-700"
    >
      <div v-if="$slots.cover" class="relative">
        <slot name="cover" />
        <slot v-if="$slots.overlay" name="overlay" />
        <div v-if="$slots.badge" class="absolute top-3 left-3 z-20">
          <slot name="badge" />
        </div>
      </div>
      <div class="p-6 flex flex-col grow">
        <slot name="content" />
        <div
          v-if="$slots.footer"
          class="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700"
        >
          <slot name="footer" />
        </div>
      </div>
    </article>
  </a>
</template>

<script setup lang="ts">
interface Props {
	href: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	class: "",
});

const className = props.class;
</script>