<script setup lang="ts">
import { Switch } from "@ark-ui/vue/switch";
import { academyAccount } from "@rawkodeacademy/design-system";
const s = academyAccount();
defineProps<{ checked: boolean; disabled?: boolean; label: string }>();
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
	<Switch.Root :class="s.switchRoot" :checked="checked" :disabled="disabled" @checked-change="emit('change', $event.checked)">
		<Switch.HiddenInput />
		<Switch.Label :class="s.hidden">{{ label }}</Switch.Label>
		<Switch.Control :class="s.switchControl"><Switch.Thumb :class="s.switchThumb" /></Switch.Control>
	</Switch.Root>
</template>
