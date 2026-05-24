<template>
 <div :class="['terminal dark: rounded-sm overflow-hidden border border-gray-700/40 dark:border-gray-600/60', className]">
 <div class="terminal-header bg-gray-800/80 dark:bg-gray-700/90 px-4 py-2 flex items-center justify-between border-b border-gray-700/40 dark:border-gray-600/60">
 <div class="flex space-x-2">
 <div class="w-3 h-3 bg-red-500 rounded-full"></div>
 <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
 <div class="w-3 h-3 bg-green-500 rounded-full"></div>
 </div>
 <div class="text-gray-400 dark:text-gray-300 text-sm font-mono">{{ title }}</div>
 <div class="w-14"></div>
 </div>
 <div class="terminal-body bg-gray-900/90 dark:bg-gray-800/95 text-gray-100 dark:text-gray-50 p-4 font-mono text-sm">
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