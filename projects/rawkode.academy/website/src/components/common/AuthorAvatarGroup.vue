<template>
  <div class="flex items-center space-x-3">
    <div class="flex -space-x-3">
      <div
        v-for="(author, index) in displayAuthors"
        :key="author.data.handle"
        class="relative"
        :style="`z-index: ${10 - index}`"
      >
        <img
          class="w-10 h-10 rounded-full object-cover border-2 border-purple-500 p-0.5 bg-white"
          :src="`https://avatars.githubusercontent.com/${author.data.handle}`"
          :alt="`Profile picture of ${author.data.name}`"
          loading="lazy"
        />
        <span
          v-if="showActiveIndicator && index === 0"
          class="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"
        ></span>
      </div>
      <div
        v-if="remainingCount > 0"
        class="relative"
        style="z-index: 0;"
      >
        <div class="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-500 p-0.5 bg-white flex items-center justify-center text-xs text-purple-800 font-medium">
          +{{ remainingCount }}
        </div>
      </div>
    </div>
    <div v-if="showNames" class="font-medium dark:text-white">
      <div class="text-sm">{{ authorNames }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CollectionEntry } from "astro:content";
import { computed } from "vue";

interface Props {
	authors: CollectionEntry<"people">[];
	maxDisplay?: number;
	showNames?: boolean;
	showActiveIndicator?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	maxDisplay: 3,
	showNames: true,
	showActiveIndicator: true,
});

const displayAuthors = computed(() => props.authors.slice(0, props.maxDisplay));
const remainingCount = computed(() => props.authors.length - props.maxDisplay);
const authorNames = computed(() =>
	props.authors.map((author) => author.data.name).join(", "),
);
</script>