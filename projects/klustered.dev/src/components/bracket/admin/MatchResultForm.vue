<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";

interface Competitor {
	id: string;
	name: string;
	displayName: string | null;
	imageUrl: string | null;
}

interface Match {
	id: string;
	bracketId: string;
	round: number;
	position: number;
	competitor1Id: string | null;
	competitor2Id: string | null;
	winnerId: string | null;
	status: "pending" | "scheduled" | "live" | "completed";
	scheduledAt: Date | null;
	streamUrl: string | null;
	vodUrl: string | null;
	notes: string | null;
}

const props = defineProps<{
	match: Match;
	competitors: Competitor[];
	roundName: string;
}>();

const emit = defineEmits<{
	(e: "updated"): void;
}>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const showDetails = ref(false);

const status = ref(props.match.status);
const streamUrl = ref(props.match.streamUrl ?? "");
const vodUrl = ref(props.match.vodUrl ?? "");
const notes = ref(props.match.notes ?? "");
const scheduledAt = ref("");

function formatDateTimeLocal(date: Date | null): string {
	if (!date) return "";
	const d = new Date(date);
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
	if (props.match.scheduledAt) {
		scheduledAt.value = formatDateTimeLocal(new Date(props.match.scheduledAt));
	}
});

function setQuickSchedule(hoursFromNow: number) {
	const date = new Date();
	date.setHours(date.getHours() + hoursFromNow);
	date.setMinutes(0, 0, 0);
	scheduledAt.value = formatDateTimeLocal(date);
}

function clearSchedule() {
	scheduledAt.value = "";
}

const competitor1 = computed(() =>
	props.competitors.find((c) => c.id === props.match.competitor1Id),
);

const competitor2 = computed(() =>
	props.competitors.find((c) => c.id === props.match.competitor2Id),
);

const winner = computed(() =>
	props.competitors.find((c) => c.id === props.match.winnerId),
);

const canSetResult = computed(() => {
	return (
		props.match.competitor1Id &&
		props.match.competitor2Id &&
		props.match.status !== "completed"
	);
});

const isBye = computed(() => {
	return !props.match.competitor1Id || !props.match.competitor2Id;
});

function getCompetitorName(competitor: Competitor | undefined): string {
	if (!competitor) return "TBD";
	return competitor.displayName || competitor.name;
}

async function setWinner(winnerId: string) {
	if (!canSetResult.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.setMatchResult({
			matchId: props.match.id,
			winnerId,
		});

		if (actionError) throw new Error(actionError.message);

		emit("updated");
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to set result";
	} finally {
		isLoading.value = false;
	}
}

async function updateMatchDetails() {
	isLoading.value = true;
	error.value = null;

	try {
		const scheduledAtValue = scheduledAt.value
			? new Date(scheduledAt.value).toISOString()
			: null;

		const { error: actionError } = await actions.bracket.updateMatch({
			matchId: props.match.id,
			status: status.value,
			scheduledAt: scheduledAtValue,
			streamUrl: streamUrl.value || null,
			vodUrl: vodUrl.value || null,
			notes: notes.value || null,
		});

		if (actionError) throw new Error(actionError.message);

		emit("updated");
		showDetails.value = false;
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to update match";
	} finally {
		isLoading.value = false;
	}
}

function getStatusClass(): string {
	switch (props.match.status) {
		case "completed":
			return "status-completed";
		case "live":
			return "status-live";
		case "scheduled":
			return "status-scheduled";
		default:
			return "status-pending";
	}
}
</script>

<template>
	<div class="match-card">
		<div class="match-header">
			<span class="round-name">{{ roundName }}</span>
			<span class="match-position">Match {{ match.position + 1 }}</span>
			<span :class="['status-indicator', getStatusClass()]">
				{{ match.status }}
			</span>
		</div>

		<div v-if="error" class="error-message">
			{{ error }}
		</div>

		<div v-if="isBye && match.status === 'completed'" class="bye-indicator">
			BYE - {{ getCompetitorName(winner) }} advances
		</div>

		<div v-else class="competitors">
			<button
				@click="setWinner(match.competitor1Id!)"
				:disabled="!canSetResult || isLoading"
				:class="[
					'competitor-slot',
					{
						'is-winner': match.winnerId === match.competitor1Id,
						'is-loser': match.winnerId && match.winnerId !== match.competitor1Id,
						'clickable': canSetResult,
					}
				]"
			>
				<img
					v-if="competitor1?.imageUrl"
					:src="competitor1.imageUrl"
					:alt="getCompetitorName(competitor1)"
					class="competitor-avatar"
				/>
				<span class="competitor-name">{{ getCompetitorName(competitor1) }}</span>
				<span v-if="match.winnerId === match.competitor1Id" class="winner-badge">W</span>
			</button>

			<span class="versus">vs</span>

			<button
				@click="setWinner(match.competitor2Id!)"
				:disabled="!canSetResult || isLoading"
				:class="[
					'competitor-slot',
					{
						'is-winner': match.winnerId === match.competitor2Id,
						'is-loser': match.winnerId && match.winnerId !== match.competitor2Id,
						'clickable': canSetResult,
					}
				]"
			>
				<img
					v-if="competitor2?.imageUrl"
					:src="competitor2.imageUrl"
					:alt="getCompetitorName(competitor2)"
					class="competitor-avatar"
				/>
				<span class="competitor-name">{{ getCompetitorName(competitor2) }}</span>
				<span v-if="match.winnerId === match.competitor2Id" class="winner-badge">W</span>
			</button>
		</div>

		<button
			@click="showDetails = !showDetails"
			class="details-toggle"
		>
			{{ showDetails ? "Hide Details" : "Edit Details" }}
		</button>

		<div v-if="showDetails" class="details-form">
			<div class="form-group">
				<label class="form-label">Status</label>
				<select v-model="status" class="form-select">
					<option value="pending">Pending</option>
					<option value="scheduled">Scheduled</option>
					<option value="live">Live</option>
					<option value="completed">Completed</option>
				</select>
			</div>

			<div class="form-group">
				<label class="form-label">Scheduled Date/Time</label>
				<input
					v-model="scheduledAt"
					type="datetime-local"
					class="form-input"
				/>
				<div class="quick-schedule-buttons">
					<button type="button" @click="setQuickSchedule(1)" class="quick-btn">+1h</button>
					<button type="button" @click="setQuickSchedule(2)" class="quick-btn">+2h</button>
					<button type="button" @click="setQuickSchedule(24)" class="quick-btn">+1d</button>
					<button type="button" @click="setQuickSchedule(48)" class="quick-btn">+2d</button>
					<button type="button" @click="clearSchedule" class="quick-btn clear-btn">Clear</button>
				</div>
			</div>

			<div class="form-group">
				<label class="form-label">Stream URL</label>
				<input
					v-model="streamUrl"
					type="url"
					class="form-input"
					placeholder="https://..."
				/>
			</div>

			<div class="form-group">
				<label class="form-label">VOD URL</label>
				<input
					v-model="vodUrl"
					type="url"
					class="form-input"
					placeholder="https://..."
				/>
			</div>

			<div class="form-group">
				<label class="form-label">Notes</label>
				<textarea
					v-model="notes"
					class="form-textarea"
					rows="2"
					placeholder="Optional notes..."
				></textarea>
			</div>

			<button
				@click="updateMatchDetails"
				:disabled="isLoading"
				class="btn btn-primary"
			>
				<span v-if="isLoading" class="spinner"></span>
				<span v-else>Save Details</span>
			</button>
		</div>
	</div>
</template>

<style scoped>
.match-card {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.match-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-wrap: wrap;
}

.round-name {
	font-size: 0.75rem;
	font-weight: 600;
	color: #a78bfa;
	text-transform: uppercase;
}

.match-position {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.5);
}

.status-indicator {
	margin-left: auto;
	font-size: 0.625rem;
	font-weight: 600;
	padding: 0.25rem 0.5rem;
	border-radius: 9999px;
	text-transform: uppercase;
}

.status-pending {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.5);
}

.status-scheduled {
	background: rgba(99, 102, 241, 0.2);
	color: #a5b4fc;
}

.status-live {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	animation: pulse 2s infinite;
}

.status-completed {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}

.error-message {
	padding: 0.5rem;
	background: rgba(239, 68, 68, 0.1);
	border-radius: 0.375rem;
	color: #fca5a5;
	font-size: 0.75rem;
}

.bye-indicator {
	padding: 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 0.5rem;
	text-align: center;
	color: rgba(255, 255, 255, 0.6);
	font-size: 0.875rem;
	font-style: italic;
}

.competitors {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.versus {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.3);
	text-transform: uppercase;
}

.competitor-slot {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5rem;
	color: white;
	font-size: 0.875rem;
	text-align: left;
	cursor: default;
	transition: all 0.2s;
}

.competitor-slot.clickable {
	cursor: pointer;
}

.competitor-slot.clickable:hover:not(:disabled) {
	background: rgba(139, 92, 246, 0.1);
	border-color: rgba(139, 92, 246, 0.3);
}

.competitor-slot:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.competitor-slot.is-winner {
	background: rgba(34, 197, 94, 0.1);
	border-color: rgba(34, 197, 94, 0.3);
}

.competitor-slot.is-loser {
	opacity: 0.5;
}

.competitor-avatar {
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	object-fit: cover;
}

.competitor-name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.winner-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.25rem;
	height: 1.25rem;
	background: #22c55e;
	border-radius: 50%;
	font-size: 0.625rem;
	font-weight: 700;
}

.details-toggle {
	padding: 0.5rem;
	background: transparent;
	border: none;
	color: rgba(255, 255, 255, 0.5);
	font-size: 0.75rem;
	cursor: pointer;
	transition: color 0.2s;
}

.details-toggle:hover {
	color: rgba(255, 255, 255, 0.8);
}

.details-form {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding-top: 0.75rem;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.form-label {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
}

.form-input,
.form-select,
.form-textarea {
	padding: 0.5rem 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.375rem;
	color: white;
	font-size: 0.875rem;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
	outline: none;
	border-color: rgba(139, 92, 246, 0.5);
}

.form-select {
	cursor: pointer;
}

.form-select option {
	background: #1a1a2e;
}

.form-textarea {
	resize: vertical;
}

.quick-schedule-buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;
	margin-top: 0.375rem;
}

.quick-btn {
	padding: 0.25rem 0.5rem;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.25rem;
	color: rgba(255, 255, 255, 0.7);
	font-size: 0.7rem;
	cursor: pointer;
	transition: all 0.2s;
}

.quick-btn:hover {
	background: rgba(139, 92, 246, 0.2);
	border-color: rgba(139, 92, 246, 0.4);
	color: white;
}

.quick-btn.clear-btn {
	color: rgba(239, 68, 68, 0.8);
	border-color: rgba(239, 68, 68, 0.3);
}

.quick-btn.clear-btn:hover {
	background: rgba(239, 68, 68, 0.2);
	border-color: rgba(239, 68, 68, 0.5);
	color: #fca5a5;
}

.btn {
	padding: 0.5rem 1rem;
	border-radius: 0.375rem;
	font-size: 0.875rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s;
	border: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
}

.btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.btn-primary {
	background: linear-gradient(135deg, #8b5cf6, #6366f1);
	color: white;
}

.btn-primary:hover:not(:disabled) {
	opacity: 0.9;
}

.spinner {
	width: 0.875rem;
	height: 0.875rem;
	border: 2px solid currentColor;
	border-right-color: transparent;
	border-radius: 50%;
	animation: spin 0.75s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
