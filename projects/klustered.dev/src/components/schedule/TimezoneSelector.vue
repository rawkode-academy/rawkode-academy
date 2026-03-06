<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
	COMMON_TIMEZONES,
	getUserTimezone,
	setUserTimezone,
} from "@/lib/timezone";

const emit = defineEmits<{
	(e: "change", timezone: string): void;
}>();

const selectedTimezone = ref("UTC");

onMounted(() => {
	selectedTimezone.value = getUserTimezone();
	emit("change", selectedTimezone.value);
});

function handleChange(event: Event) {
	const target = event.target as HTMLSelectElement;
	selectedTimezone.value = target.value;
	setUserTimezone(target.value);
	emit("change", target.value);
}
</script>

<template>
	<div class="timezone-selector">
		<label for="timezone-select" class="sr-only">Timezone</label>
		<div class="select-wrapper">
			<svg
				class="globe-icon"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M2 12h20" />
				<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
			</svg>
			<select
				id="timezone-select"
				:value="selectedTimezone"
				@change="handleChange"
				class="select"
			>
				<option
					v-for="tz in COMMON_TIMEZONES"
					:key="tz.value"
					:value="tz.value"
				>
					{{ tz.label }}
				</option>
			</select>
			<svg
				class="chevron-icon"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</div>
</template>

<style scoped>
.timezone-selector {
	display: inline-flex;
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	border: 0;
}

.select-wrapper {
	position: relative;
	display: inline-flex;
	align-items: center;
}

.globe-icon {
	position: absolute;
	left: 0.625rem;
	color: rgba(255, 255, 255, 0.5);
	pointer-events: none;
}

.select {
	appearance: none;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5rem;
	padding: 0.5rem 2rem 0.5rem 2rem;
	color: white;
	font-size: 0.8125rem;
	cursor: pointer;
	transition: all 0.2s;
	min-width: 140px;
}

.select:hover {
	border-color: rgba(139, 92, 246, 0.4);
	background: rgba(255, 255, 255, 0.08);
}

.select:focus {
	outline: none;
	border-color: rgba(139, 92, 246, 0.6);
	box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.select option {
	background: #1a1a2e;
	color: white;
}

.chevron-icon {
	position: absolute;
	right: 0.625rem;
	color: rgba(255, 255, 255, 0.5);
	pointer-events: none;
}
</style>
