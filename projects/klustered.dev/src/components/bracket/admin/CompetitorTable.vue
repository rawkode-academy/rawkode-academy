<script setup lang="ts">
import { ref, computed } from "vue";
import { actions } from "astro:actions";

interface Competitor {
	id: string;
	bracketId: string;
	name: string;
	displayName: string | null;
	imageUrl: string | null;
	seed: number | null;
	userId: string | null;
	confirmed: boolean;
	confirmedAt: Date | null;
}

interface Bracket {
	id: string;
	status: "draft" | "registration" | "active" | "completed";
}

const props = defineProps<{
	competitors: Competitor[];
	bracket: Bracket;
}>();

const emit = defineEmits<{
	(e: "refresh"): void;
}>();

const isLoading = ref<string | null>(null);
const error = ref<string | null>(null);
const editingSeed = ref<string | null>(null);
const seedValue = ref<string>("");

const sortedCompetitors = computed(() => {
	return [...props.competitors].sort((a, b) => {
		if (a.seed === null && b.seed === null) return a.name.localeCompare(b.name);
		if (a.seed === null) return 1;
		if (b.seed === null) return -1;
		return a.seed - b.seed;
	});
});

const confirmedCount = computed(() => props.competitors.filter((c) => c.confirmed).length);
const totalCount = computed(() => props.competitors.length);

const canEdit = computed(() => {
	return props.bracket.status === "draft" || props.bracket.status === "registration";
});

function startEditingSeed(competitor: Competitor) {
	editingSeed.value = competitor.id;
	seedValue.value = competitor.seed?.toString() ?? "";
}

async function saveSeed(competitorId: string) {
	isLoading.value = competitorId;
	error.value = null;

	try {
		const seed = seedValue.value.trim() ? parseInt(seedValue.value, 10) : null;
		if (seedValue.value.trim() && isNaN(seed!)) {
			throw new Error("Seed must be a number");
		}

		const { error: actionError } = await actions.bracket.setSeed({
			competitorId,
			seed,
		});

		if (actionError) throw new Error(actionError.message);

		editingSeed.value = null;
		emit("refresh");
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to save seed";
	} finally {
		isLoading.value = null;
	}
}

function cancelEditingSeed() {
	editingSeed.value = null;
	seedValue.value = "";
}

async function toggleConfirmed(competitor: Competitor) {
	isLoading.value = competitor.id;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.updateCompetitor({
			competitorId: competitor.id,
			confirmed: !competitor.confirmed,
		});

		if (actionError) throw new Error(actionError.message);

		emit("refresh");
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to update";
	} finally {
		isLoading.value = null;
	}
}

async function removeCompetitor(competitorId: string) {
	if (!confirm("Are you sure you want to remove this competitor?")) return;

	isLoading.value = competitorId;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.removeCompetitor({
			competitorId,
		});

		if (actionError) throw new Error(actionError.message);

		emit("refresh");
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to remove";
	} finally {
		isLoading.value = null;
	}
}

async function importRegistrations() {
	isLoading.value = "import";
	error.value = null;

	try {
		const { data, error: actionError } = await actions.bracket.importRegistrations({
			bracketId: props.bracket.id,
		});

		if (actionError) throw new Error(actionError.message);

		if (data?.imported === 0) {
			error.value = "No new registrations to import";
		}

		emit("refresh");
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to import";
	} finally {
		isLoading.value = null;
	}
}
</script>

<template>
	<div class="competitor-table-container">
		<div class="table-header">
			<div class="stats">
				<span class="stat">
					<strong>{{ confirmedCount }}</strong> confirmed
				</span>
				<span class="divider">/</span>
				<span class="stat">
					<strong>{{ totalCount }}</strong> total
				</span>
			</div>
			<button
				v-if="canEdit"
				@click="importRegistrations"
				:disabled="isLoading === 'import'"
				class="btn btn-secondary"
			>
				<span v-if="isLoading === 'import'" class="spinner"></span>
				<span v-else>Import Registrations</span>
			</button>
		</div>

		<div v-if="error" class="error-banner">
			{{ error }}
			<button @click="error = null" class="error-dismiss">&times;</button>
		</div>

		<div v-if="competitors.length === 0" class="empty-state">
			<p>No competitors yet.</p>
			<p>Use "Import Registrations" to pull from email preferences.</p>
		</div>

		<table v-else class="competitor-table">
			<thead>
				<tr>
					<th class="col-seed">Seed</th>
					<th class="col-name">Name</th>
					<th class="col-status">Status</th>
					<th class="col-actions">Actions</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="competitor in sortedCompetitors"
					:key="competitor.id"
					:class="{ 'row-unconfirmed': !competitor.confirmed }"
				>
					<td class="col-seed">
						<template v-if="editingSeed === competitor.id">
							<div class="seed-edit">
								<input
									v-model="seedValue"
									type="number"
									min="1"
									class="seed-input"
									@keyup.enter="saveSeed(competitor.id)"
									@keyup.escape="cancelEditingSeed"
								/>
								<button
									@click="saveSeed(competitor.id)"
									:disabled="isLoading === competitor.id"
									class="btn-icon btn-save"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</button>
								<button @click="cancelEditingSeed" class="btn-icon btn-cancel">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</template>
						<template v-else>
							<button
								v-if="canEdit"
								@click="startEditingSeed(competitor)"
								class="seed-display clickable"
							>
								{{ competitor.seed ?? "-" }}
							</button>
							<span v-else class="seed-display">
								{{ competitor.seed ?? "-" }}
							</span>
						</template>
					</td>
					<td class="col-name">
						<div class="competitor-info">
							<img
								v-if="competitor.imageUrl"
								:src="competitor.imageUrl"
								:alt="competitor.name"
								class="competitor-avatar"
							/>
							<div class="competitor-details">
								<span class="competitor-name">
									{{ competitor.displayName || competitor.name }}
								</span>
								<span v-if="competitor.displayName" class="competitor-username">
									{{ competitor.name }}
								</span>
							</div>
						</div>
					</td>
					<td class="col-status">
						<button
							v-if="canEdit"
							@click="toggleConfirmed(competitor)"
							:disabled="isLoading === competitor.id"
							:class="['status-badge', competitor.confirmed ? 'badge-confirmed' : 'badge-pending']"
						>
							{{ competitor.confirmed ? "Confirmed" : "Pending" }}
						</button>
						<span
							v-else
							:class="['status-badge', competitor.confirmed ? 'badge-confirmed' : 'badge-pending']"
						>
							{{ competitor.confirmed ? "Confirmed" : "Pending" }}
						</span>
					</td>
					<td class="col-actions">
						<button
							v-if="canEdit"
							@click="removeCompetitor(competitor.id)"
							:disabled="isLoading === competitor.id"
							class="btn-icon btn-danger"
							title="Remove competitor"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.competitor-table-container {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.table-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 1rem;
}

.stats {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.6);
}

.stats strong {
	color: white;
}

.divider {
	color: rgba(255, 255, 255, 0.3);
}

.error-banner {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.75rem 1rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.5rem;
	color: #fca5a5;
	font-size: 0.875rem;
}

.error-dismiss {
	background: none;
	border: none;
	color: #fca5a5;
	font-size: 1.25rem;
	cursor: pointer;
	padding: 0 0.25rem;
}

.empty-state {
	text-align: center;
	padding: 3rem;
	background: rgba(255, 255, 255, 0.02);
	border-radius: 0.5rem;
	color: rgba(255, 255, 255, 0.5);
}

.empty-state p {
	margin: 0.5rem 0;
}

.competitor-table {
	width: 100%;
	border-collapse: collapse;
}

.competitor-table th {
	text-align: left;
	padding: 0.75rem 1rem;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	color: rgba(255, 255, 255, 0.5);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.competitor-table td {
	padding: 0.75rem 1rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	vertical-align: middle;
}

.row-unconfirmed {
	opacity: 0.6;
}

.col-seed {
	width: 80px;
}

.col-status {
	width: 120px;
}

.col-actions {
	width: 60px;
	text-align: right;
}

.seed-display {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 2rem;
	height: 2rem;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 0.25rem;
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.7);
}

.seed-display.clickable {
	border: none;
	cursor: pointer;
	transition: background 0.2s;
}

.seed-display.clickable:hover {
	background: rgba(255, 255, 255, 0.1);
}

.seed-edit {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.seed-input {
	width: 3rem;
	padding: 0.25rem 0.5rem;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(139, 92, 246, 0.5);
	border-radius: 0.25rem;
	color: white;
	font-size: 0.875rem;
	text-align: center;
}

.seed-input:focus {
	outline: none;
	border-color: #8b5cf6;
}

.competitor-info {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.competitor-avatar {
	width: 2rem;
	height: 2rem;
	border-radius: 50%;
	object-fit: cover;
}

.competitor-details {
	display: flex;
	flex-direction: column;
}

.competitor-name {
	font-weight: 500;
	color: white;
}

.competitor-username {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.5);
}

.status-badge {
	display: inline-block;
	padding: 0.25rem 0.75rem;
	font-size: 0.75rem;
	font-weight: 600;
	border-radius: 9999px;
	border: none;
	cursor: default;
}

button.status-badge {
	cursor: pointer;
	transition: opacity 0.2s;
}

button.status-badge:hover:not(:disabled) {
	opacity: 0.8;
}

.badge-confirmed {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

.badge-pending {
	background: rgba(251, 191, 36, 0.2);
	color: #fde047;
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

.btn-secondary {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
}

.btn-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.75rem;
	height: 1.75rem;
	padding: 0;
	border: none;
	border-radius: 0.25rem;
	cursor: pointer;
	transition: all 0.2s;
	background: transparent;
}

.btn-icon:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-save {
	color: #22c55e;
}

.btn-save:hover:not(:disabled) {
	background: rgba(34, 197, 94, 0.2);
}

.btn-cancel {
	color: rgba(255, 255, 255, 0.5);
}

.btn-cancel:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.1);
}

.btn-danger {
	color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
	background: rgba(239, 68, 68, 0.2);
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
