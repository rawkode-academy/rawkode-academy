<template>
  <div :class="['terminal shadow-2xl rounded-lg overflow-hidden', className]">
    <div class="terminal-header bg-gray-800 px-4 py-2 flex items-center justify-between">
      <div class="flex space-x-2">
        <div class="w-3 h-3 bg-red-500 rounded-full"></div>
        <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div class="w-3 h-3 bg-green-500 rounded-full"></div>
      </div>
      <div class="text-gray-400 text-sm font-mono">{{ title }}</div>
      <div class="w-14"></div>
    </div>
    <div class="terminal-body bg-gray-900 text-gray-100 p-4 font-mono text-sm">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
	title?: string;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	title: "Terminal",
	class: "",
});

const className = props.class;
</script>

<style scoped>
.terminal {
  background: #1a1a1a;
}

.terminal-body {
  min-height: 100px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>