<script setup lang="ts">
import { ref, onMounted } from "vue";
import { actions } from "astro:actions";
import { formatInTimezone, getUserTimezone } from "@/lib/timezone";

interface Bracket {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
	status: "draft" | "registration" | "active" | "completed";
	startedAt?: Date | null;
}

interface Competitor {
	id: string;
	bracketId: string;
	name: string;
	seed: number | null;
	confirmed: boolean;
	confirmedAt: Date | null;
}

interface Match {
	scheduledAt: Date | null;
}

const props = defineProps<{
	bracket: Bracket;
	competitor: Competitor;
	firstMatch?: Match | null;
}>();

const timezone = ref("UTC");

onMounted(() => {
	timezone.value = getUserTimezone();
});

const emit = defineEmits<{
	(e: "updated", confirmed: boolean): void;
}>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const localConfirmed = ref(props.competitor.confirmed);

async function handleConfirm() {
	isLoading.value = true;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.confirmParticipation({
			bracketId: props.bracket.id,
		});

		if (actionError) throw new Error(actionError.message);

		localConfirmed.value = true;
		emit("updated", true);
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to confirm";
	} finally {
		isLoading.value = false;
	}
}

async function handleWithdraw() {
	isLoading.value = true;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.withdrawParticipation({
			bracketId: props.bracket.id,
		});

		if (actionError) throw new Error(actionError.message);

		localConfirmed.value = false;
		emit("updated", false);
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to withdraw";
	} finally {
		isLoading.value = false;
	}
}

function getStatusBadgeClass(): string {
	if (localConfirmed.value) return "badge-confirmed";
	return "badge-pending";
}

function getStatusText(): string {
	if (localConfirmed.value) return "Confirmed";
	return "Pending Confirmation";
}

function canModify(): boolean {
	return props.bracket.status === "draft" || props.bracket.status === "registration";
}
</script>

<template>
	<div class="confirmation-card">
		<div class="card-header">
			<div class="bracket-info">
				<h3 class="bracket-name">{{ bracket.name }}</h3>
				<span :class="['type-badge', `type-${bracket.type}`]">
					{{ bracket.type === "solo" ? "Solo" : "Team" }}
				</span>
			</div>
			<span :class="['status-badge', getStatusBadgeClass()]">
				{{ getStatusText() }}
			</span>
		</div>

		<div v-if="error" class="error-message">
			{{ error }}
		</div>

		<div v-if="competitor.seed" class="seed-info">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
			</svg>
			<span>Seed #{{ competitor.seed }}</span>
		</div>

		<div v-if="firstMatch?.scheduledAt || bracket.startedAt" class="schedule-info">
			<div class="schedule-header">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
				<span>Schedule</span>
			</div>
			<p v-if="firstMatch?.scheduledAt" class="schedule-text">
				Competition begins: {{ formatInTimezone(firstMatch.scheduledAt, timezone) }}
			</p>
			<p v-else-if="bracket.startedAt" class="schedule-text">
				Competition started: {{ formatInTimezone(bracket.startedAt, timezone) }}
			</p>
			<p v-else class="schedule-text schedule-tbd">
				Match schedule will be announced soon
			</p>
		</div>

		<div class="card-actions">
			<template v-if="canModify()">
				<button
					v-if="!localConfirmed"
					@click="handleConfirm"
					:disabled="isLoading"
					class="btn btn-confirm"
				>
					<span v-if="isLoading" class="spinner"></span>
					<span v-else>Confirm Participation</span>
				</button>
				<button
					v-else
					@click="handleWithdraw"
					:disabled="isLoading"
					class="btn btn-withdraw"
				>
					<span v-if="isLoading" class="spinner"></span>
					<span v-else>Withdraw</span>
				</button>
			</template>
			<template v-else>
				<p class="locked-message">
					<template v-if="bracket.status === 'active'">
						Bracket is now active - modifications are locked
					</template>
					<template v-else>
						Bracket has completed
					</template>
				</p>
			</template>
		</div>

		<div v-if="localConfirmed" class="next-steps">
			<h4 class="next-steps-title">Next Steps</h4>
			<ul class="next-steps-list">
				<li class="step completed">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
					Registration confirmed
				</li>
				<li class="step">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
					</svg>
					Check the schedule for your match times
				</li>
				<li class="step">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
					</svg>
					Review competition rules before your match
				</li>
				<li class="step">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
					</svg>
					Join the stream when your match is live
				</li>
			</ul>
		</div>

		<div class="card-links">
			<a :href="`/bracket/${bracket.slug}`" class="card-link">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
				</svg>
				View Bracket
			</a>
			<a href="/schedule" class="card-link">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
				Full Schedule
			</a>
			<a href="/rules" class="card-link">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				Competition Rules
			</a>
		</div>
	</div>
</template>

<style scoped>
.confirmation-card {
	background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
	border: 1px solid rgba(99, 102, 241, 0.2);
	border-radius: 1rem;
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 1rem;
	flex-wrap: wrap;
}

.bracket-info {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.bracket-name {
	font-size: 1.25rem;
	font-weight: 600;
	color: white;
	margin: 0;
}

.type-badge {
	font-size: 0.75rem;
	font-weight: 600;
	padding: 0.25rem 0.75rem;
	border-radius: 9999px;
	text-transform: uppercase;
}

.type-solo {
	background: rgba(99, 102, 241, 0.2);
	color: #a5b4fc;
}

.type-team {
	background: rgba(168, 85, 247, 0.2);
	color: #d8b4fe;
}

.status-badge {
	font-size: 0.75rem;
	font-weight: 600;
	padding: 0.25rem 0.75rem;
	border-radius: 9999px;
}

.badge-confirmed {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

.badge-pending {
	background: rgba(251, 191, 36, 0.2);
	color: #fde047;
}

.error-message {
	padding: 0.75rem 1rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.5rem;
	color: #fca5a5;
	font-size: 0.875rem;
}

.card-actions {
	display: flex;
	gap: 0.75rem;
}

.btn {
	padding: 0.75rem 1.5rem;
	border-radius: 0.5rem;
	font-size: 0.875rem;
	font-weight: 600;
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

.btn-confirm {
	background: linear-gradient(135deg, #22c55e, #16a34a);
	color: white;
}

.btn-confirm:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.btn-withdraw {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-withdraw:hover:not(:disabled) {
	background: rgba(239, 68, 68, 0.3);
}

.locked-message {
	color: rgba(255, 255, 255, 0.6);
	font-size: 0.875rem;
	font-style: italic;
	margin: 0;
}

.seed-info {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	background: rgba(251, 191, 36, 0.1);
	border-radius: 0.5rem;
	color: #fde047;
	font-size: 0.875rem;
	font-weight: 600;
}

.schedule-info {
	padding: 0.75rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5rem;
}

.schedule-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	color: rgba(255, 255, 255, 0.7);
	font-size: 0.75rem;
	font-weight: 600;
	margin-bottom: 0.375rem;
}

.schedule-text {
	color: white;
	font-size: 0.875rem;
	margin: 0;
}

.schedule-text.schedule-tbd {
	color: rgba(255, 255, 255, 0.5);
	font-style: italic;
}

.next-steps {
	padding: 0.75rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5rem;
}

.next-steps-title {
	font-size: 0.8125rem;
	font-weight: 600;
	color: white;
	margin: 0 0 0.5rem 0;
}

.next-steps-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.step {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.8125rem;
	color: rgba(255, 255, 255, 0.6);
}

.step.completed {
	color: #86efac;
}

.card-links {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.card-link {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.5rem 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.375rem;
	font-size: 0.8125rem;
	color: rgba(255, 255, 255, 0.8);
	text-decoration: none;
	transition: all 0.2s;
}

.card-link:hover {
	background: rgba(139, 92, 246, 0.15);
	border-color: rgba(139, 92, 246, 0.4);
	color: white;
}

.spinner {
	width: 1rem;
	height: 1rem;
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
