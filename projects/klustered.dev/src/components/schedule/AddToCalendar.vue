<script setup lang="ts">
import { ref } from "vue";
import { downloadICalFile, generateGoogleCalendarUrl } from "@/lib/timezone";

interface Props {
	title: string;
	description?: string;
	startDate: Date | string;
	endDate?: Date | string;
	location?: string;
	url?: string;
}

const props = defineProps<Props>();

const showDropdown = ref(false);

function getStartDate(): Date {
	return new Date(props.startDate);
}

function getEndDate(): Date | undefined {
	return props.endDate ? new Date(props.endDate) : undefined;
}

function handleGoogleCalendar() {
	const url = generateGoogleCalendarUrl({
		title: props.title,
		description: props.description,
		startDate: getStartDate(),
		endDate: getEndDate(),
		location: props.location,
	});
	window.open(url, "_blank", "noopener,noreferrer");
	showDropdown.value = false;
}

function handleDownloadIcs() {
	downloadICalFile(
		{
			title: props.title,
			description: props.description,
			startDate: getStartDate(),
			endDate: getEndDate(),
			location: props.location,
			url: props.url,
		},
		`${props.title.replace(/\s+/g, "-").toLowerCase()}.ics`,
	);
	showDropdown.value = false;
}

function toggleDropdown() {
	showDropdown.value = !showDropdown.value;
}

function closeDropdown() {
	showDropdown.value = false;
}
</script>

<template>
	<div class="calendar-dropdown" v-click-away="closeDropdown">
		<button
			type="button"
			@click="toggleDropdown"
			class="calendar-btn"
			title="Add to Calendar"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
				<line x1="16" y1="2" x2="16" y2="6" />
				<line x1="8" y1="2" x2="8" y2="6" />
				<line x1="3" y1="10" x2="21" y2="10" />
			</svg>
		</button>

		<div v-if="showDropdown" class="dropdown-menu">
			<button type="button" @click="handleGoogleCalendar" class="dropdown-item">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 18h-11c-.8 0-1.5-.7-1.5-1.5v-11C5 4.7 5.7 4 6.5 4h11c.8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5z"/>
				</svg>
				Google Calendar
			</button>
			<button type="button" @click="handleDownloadIcs" class="dropdown-item">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
				Download .ics
			</button>
		</div>
	</div>
</template>

<style scoped>
.calendar-dropdown {
	position: relative;
	display: inline-flex;
}

.calendar-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	padding: 0;
	background: rgba(139, 92, 246, 0.15);
	border: 1px solid rgba(139, 92, 246, 0.3);
	border-radius: 0.375rem;
	color: #c4b5fd;
	cursor: pointer;
	transition: all 0.2s;
}

.calendar-btn:hover {
	background: rgba(139, 92, 246, 0.25);
	border-color: rgba(139, 92, 246, 0.5);
	color: white;
}

.dropdown-menu {
	position: absolute;
	top: 100%;
	right: 0;
	z-index: 50;
	margin-top: 0.25rem;
	min-width: 160px;
	background: #1a1a2e;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5rem;
	box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
	overflow: hidden;
}

.dropdown-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	width: 100%;
	padding: 0.625rem 0.875rem;
	background: transparent;
	border: none;
	color: rgba(255, 255, 255, 0.8);
	font-size: 0.8125rem;
	text-align: left;
	cursor: pointer;
	transition: all 0.15s;
}

.dropdown-item:hover {
	background: rgba(139, 92, 246, 0.2);
	color: white;
}

.dropdown-item + .dropdown-item {
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
