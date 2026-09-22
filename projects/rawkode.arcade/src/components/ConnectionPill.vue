<script setup lang="ts">
import type { ConnectionState } from "@/lib/live-contract";
import { statusDot, statusPill } from "@/styles/arcade";

const props = defineProps<{ state: ConnectionState }>();

/** The dot never carries the state alone; the text label always accompanies it. */
const labels: Record<ConnectionState, string> = {
	connected: "Connected",
	connecting: "Connecting",
	reconnecting: "Reconnecting",
	offline: "Offline",
};
</script>

<template>
	<span
		:class="statusPill({ state: props.state })"
		data-testid="connection-status"
		:role="props.state === 'offline' ? 'alert' : 'status'"
		aria-live="polite"
	>
		<i :class="statusDot({ pulse: props.state === 'connecting' || props.state === 'reconnecting' })" aria-hidden="true" />
		{{ labels[props.state] }}
	</span>
</template>
