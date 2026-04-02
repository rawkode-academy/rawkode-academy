<template>
  <div :class="cx(terminalClass, className)">
    <div :class="headerClass">
      <div :class="css({ display: 'flex', gap: '2' })">
        <div :class="css({ width: '3', height: '3', bg: 'red.500', borderRadius: 'full' })"></div>
        <div :class="css({ width: '3', height: '3', bg: 'yellow.500', borderRadius: 'full' })"></div>
        <div :class="css({ width: '3', height: '3', bg: 'green.500', borderRadius: 'full' })"></div>
      </div>
      <div :class="css({ color: { base: 'gray.400', _dark: 'gray.300' }, fontSize: 'sm', fontFamily: 'mono' })">{{ title }}</div>
      <div :class="css({ width: '14' })"></div>
    </div>
    <div :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { css, cx } from "../../../styled-system/css";

interface Props {
	title?: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	title: "Terminal",
	class: "",
});

const className = props.class;

const terminalClass = css({
	shadow: { base: "0 8px 32px 0 rgba(0,0,0,0.3)", _dark: "0 8px 32px 0 rgba(0,0,0,0.6)" },
	borderRadius: "xl",
	overflow: "hidden",
	border: "1px solid",
	borderColor: { base: "rgba(55, 65, 81, 0.4)", _dark: "rgba(75, 85, 99, 0.6)" },
	background: "#1a1a1a",
});

const headerClass = css({
	bg: { base: "rgba(31, 41, 55, 0.8)", _dark: "rgba(55, 65, 81, 0.9)" },
	backdropFilter: "blur(12px)",
	px: "4",
	py: "2",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	borderBottom: "1px solid",
	borderColor: { base: "rgba(55, 65, 81, 0.4)", _dark: "rgba(75, 85, 99, 0.6)" },
});

const bodyClass = css({
	bg: { base: "rgba(17, 24, 39, 0.9)", _dark: "rgba(31, 41, 55, 0.95)" },
	backdropFilter: "blur(4px)",
	color: { base: "gray.100", _dark: "gray.50" },
	p: "4",
	fontFamily: "mono",
	fontSize: "sm",
	minHeight: "100px",
	whiteSpace: "pre-wrap",
	wordBreak: "break-all",
});
</script>
