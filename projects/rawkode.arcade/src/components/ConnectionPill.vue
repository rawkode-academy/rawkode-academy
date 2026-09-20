<script setup lang="ts">
import type { ConnectionState } from "@/lib/live-contract";
defineProps<{ state: ConnectionState }>();
</script>
<template>
	<span :class="['connection', state]" data-testid="connection-status" :role="state === 'offline' ? 'alert' : 'status'" aria-live="polite"><i aria-hidden="true"></i>{{ state }}</span>
</template>
<style scoped>
.connection { align-items: center; border: 1px solid var(--line); border-radius: 999px; color: var(--mist); display: inline-flex; font-family: "IBM Plex Mono", monospace; font-size: .65rem; gap: .38rem; letter-spacing: .06em; padding: .33rem .55rem; text-transform: uppercase; }.connection i { background: var(--amber); border-radius: 50%; height: 7px; width: 7px; }.connection.connected i { background: var(--lime); box-shadow: 0 0 0 4px rgb(201 255 99 / 12%); }.connection.reconnecting i, .connection.connecting i { animation: pulse 1.4s infinite; background: var(--amber); }.connection.offline i { background: var(--coral); } @keyframes pulse { 50% { opacity: .35; } }
</style>
