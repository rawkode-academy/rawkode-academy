<script setup lang="ts">
import { Switch } from "@ark-ui/vue/switch";

defineProps<{ checked: boolean; disabled?: boolean; label: string }>();
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
	<Switch.Root :checked="checked" :disabled="disabled" @checked-change="emit('change', $event.checked)">
		<Switch.HiddenInput />
		<Switch.Label class="sr-only">{{ label }}</Switch.Label>
		<Switch.Control
			:class="[
				'preference-switch focus-ring',
				checked ? 'is-checked' : '',
				disabled ? 'is-disabled' : '',
			]"
		>
			<Switch.Thumb class="preference-switch__thumb" />
		</Switch.Control>
	</Switch.Root>
</template>

<style scoped>
.preference-switch { position: relative; display: inline-flex; width: 2.75rem; height: 1.5rem; flex-shrink: 0; cursor: pointer; border: 2px solid var(--editorial-hairline-strong); border-radius: 999px; background: var(--surface-card-muted); transition: background-color var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard); }
.preference-switch.is-checked { border-color: transparent; background: var(--editorial-spruce); }
.preference-switch.is-disabled { cursor: wait; opacity: 0.5; }
.preference-switch__thumb { pointer-events: none; display: block; width: 1.25rem; height: 1.25rem; transform: translateX(0); border: 1px solid var(--editorial-hairline-strong); border-radius: 999px; background: var(--editorial-paper); transition: transform var(--duration-base) var(--ease-standard); }
.preference-switch__thumb[data-state="checked"] { transform: translateX(1.25rem); }
@media (prefers-reduced-motion: reduce) { .preference-switch, .preference-switch__thumb { transition: none; } }
</style>
