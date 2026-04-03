<template>
  <a :href="href" :class="['h-full', className]">
    <article
      class="glass-card-shimmer card-shadow card-hover p-0 h-full flex flex-col overflow-hidden"
    >
      <div v-if="$slots.cover" class="relative">
        <slot name="cover" />
        <slot v-if="$slots.overlay" name="overlay" />
        <div v-if="$slots.badge" class="absolute top-3 left-3 z-20">
          <slot name="badge" />
        </div>
      </div>
      <div class="card-padding flex flex-col grow relative z-10">
        <slot name="content" />
        <div
          v-if="$slots.footer"
          class="surface-divider mt-auto border-t pt-4"
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
