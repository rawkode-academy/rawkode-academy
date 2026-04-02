<template>
  <div
    :class="cx(
      'glass-card-shimmer',
      css({
        p: '6',
        shadow: 'surface',
        _hover: { shadow: 'surfaceStrong', transform: 'translateY(-2px)' },
        transition: 'all',
        transitionDuration: '300ms',
      }),
      className,
    )"
  >
    <div
      :class="css({
        display: 'flex',
        alignItems: 'center',
        mb: '4',
        position: 'relative',
        zIndex: 10,
      })"
    >
      <div
        v-if="$slots.icon"
        :class="cx(
          iconBgClass,
          css({ p: '3', borderRadius: 'full', mr: '4' }),
        )"
      >
        <slot name="icon" />
      </div>
      <h3
        :class="css({
          fontSize: 'lg',
          fontWeight: 'bold',
          color: 'fg.default',
        })"
      >
        {{ title }}
      </h3>
    </div>
    <p
      :class="css({
        color: 'fg.muted',
        position: 'relative',
        zIndex: 10,
      })"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.footer"
      :class="css({ mt: '4', position: 'relative', zIndex: 10 })"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { css, cx } from "styled-system/css";

interface Props {
	title: string;
	description: string;
	iconBgColor?: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	iconBgColor: "",
	class: "",
});

const iconBgClass = props.iconBgColor || css({ bg: "brandAccent.subtle" });
const className = props.class;
</script>
