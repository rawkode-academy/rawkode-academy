<template>
  <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
    <div :class="css({ display: 'flex' })" style="margin-left: -0.75rem;">
      <div
        v-for="(author, index) in displayAuthors"
        :key="author.id"
        :class="css({ position: 'relative' })"
        :style="`z-index: ${10 - index}; margin-left: 0.75rem;`"
      >
        <img
          :class="css({
            width: '10',
            height: '10',
            borderRadius: 'full',
            objectFit: 'cover',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'brandAccent.border',
            p: '0.5',
            bg: { base: 'white', _dark: 'gray.800' },
          })"
          :src="author.data.avatarUrl ?? '/apple-touch-icon.png'"
          :alt="`Profile picture of ${author.data.name}`"
          loading="lazy"
        />
        <span
          v-if="showActiveIndicator && index === 0"
          :class="css({
            position: 'absolute',
            bottom: '0',
            right: '0',
            height: '2.5',
            width: '2.5',
            bg: 'green.400',
            borderRadius: 'full',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: { base: 'white', _dark: 'gray.800' },
          })"
        ></span>
      </div>
      <div
        v-if="remainingCount > 0"
        :class="css({ position: 'relative' })"
        style="z-index: 0; margin-left: 0.75rem;"
      >
        <div
          :class="css({
            width: '10',
            height: '10',
            borderRadius: 'full',
            bg: 'brandAccent.subtle',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'brandAccent.border',
            p: '0.5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'xs',
            color: 'brandAccent.text',
            fontWeight: 'medium',
          })"
        >
          +{{ remainingCount }}
        </div>
      </div>
    </div>
    <div
      v-if="showNames"
      :class="css({ fontWeight: 'medium', color: 'fg.default' })"
    >
      <div :class="css({ fontSize: 'sm' })">{{ authorNames }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CollectionEntry } from "astro:content";
import { computed } from "vue";
import { css } from "styled-system/css";

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
