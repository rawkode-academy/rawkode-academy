<template>
  <a :href="href" :class="cx(css({ height: 'full' }), className)">
    <article
      :class="cx(
        'glass-card-shimmer',
        css({
          p: '0',
          height: 'full',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          shadow: 'surface',
          _hover: { shadow: 'surfaceStrong', transform: 'translateY(-2px)' },
          transition: 'all',
          transitionDuration: '300ms',
        })
      )"
    >
      <div v-if="$slots.cover" :class="css({ position: 'relative' })">
        <slot name="cover" />
        <slot v-if="$slots.overlay" name="overlay" />
        <div
          v-if="$slots.badge"
          :class="css({ position: 'absolute', top: '3', left: '3', zIndex: 20 })"
        >
          <slot name="badge" />
        </div>
      </div>
      <div
        :class="css({
          p: '6',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          position: 'relative',
          zIndex: 10,
        })"
      >
        <slot name="content" />
        <div
          v-if="$slots.footer"
          :class="css({
            mt: 'auto',
            pt: '4',
            borderTop: '1px solid',
            borderColor: { base: 'rgba(255, 255, 255, 0.2)', _dark: 'rgba(75, 85, 99, 0.5)' },
          })"
        >
          <slot name="footer" />
        </div>
      </div>
    </article>
  </a>
</template>

<script setup lang="ts">
import { css, cx } from "../../../styled-system/css";

interface Props {
	href: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	class: "",
});

const className = props.class;
</script>
