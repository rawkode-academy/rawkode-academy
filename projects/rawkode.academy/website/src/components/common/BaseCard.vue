<template>
  <a :href="href" :class="['h-full', className]">
    <article
      class="p-0 bg-white/40 dark:bg-gray-800/60 backdrop-blur-2xl rounded-xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] h-full flex flex-col transition-all duration-300 border border-white/40 dark:border-gray-600/50 hover:bg-white/60 dark:hover:bg-gray-700/70 hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.18)] dark:hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.7)] hover:scale-[1.02]"
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
          class="mt-auto pt-4 border-t border-white/20 dark:border-gray-600/50"
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