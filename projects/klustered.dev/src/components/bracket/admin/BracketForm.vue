<script setup lang="ts">
import { ref, computed } from "vue";
import { actions } from "astro:actions";

interface Bracket {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
	description: string | null;
	status: "draft" | "registration" | "active" | "completed";
}

const props = defineProps<{
	bracket?: Bracket;
	mode: "create" | "edit";
}>();

const emit = defineEmits<{
	(e: "success", bracket: Bracket): void;
	(e: "cancel"): void;
}>();

const name = ref(props.bracket?.name ?? "");
const slug = ref(props.bracket?.slug ?? "");
const type = ref<"solo" | "team">(props.bracket?.type ?? "solo");
const description = ref(props.bracket?.description ?? "");
const status = ref(props.bracket?.status ?? "draft");

const isLoading = ref(false);
const error = ref<string | null>(null);

const autoSlug = computed(() => {
	return name.value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
});

function generateSlug() {
	slug.value = autoSlug.value;
}

async function handleSubmit() {
	if (!name.value.trim()) {
		error.value = "Name is required";
		return;
	}

	if (!slug.value.trim()) {
		error.value = "Slug is required";
		return;
	}

	isLoading.value = true;
	error.value = null;

	try {
		if (props.mode === "create") {
			const { data, error: actionError } = await actions.bracket.createBracket({
				name: name.value,
				slug: slug.value,
				type: type.value,
				description: description.value || undefined,
			});

			if (actionError) throw new Error(actionError.message);
			if (data) emit("success", data);
		} else if (props.bracket) {
			const { data, error: actionError } = await actions.bracket.updateBracket({
				id: props.bracket.id,
				name: name.value,
				slug: slug.value,
				description: description.value || undefined,
				status: status.value,
			});

			if (actionError) throw new Error(actionError.message);
			if (data) emit("success", data);
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : "An error occurred";
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<form @submit.prevent="handleSubmit" class="bracket-form">
		<div v-if="error" class="error-banner">
			{{ error }}
		</div>

		<div class="form-group">
			<label for="name" class="form-label">Name</label>
			<input
				id="name"
				v-model="name"
				type="text"
				class="form-input"
				placeholder="e.g., Solo Championship 2026"
			/>
		</div>

		<div class="form-group">
			<label for="slug" class="form-label">Slug</label>
			<div class="slug-input-group">
				<input
					id="slug"
					v-model="slug"
					type="text"
					class="form-input"
					placeholder="e.g., solo-2026"
					pattern="[a-z0-9-]+"
				/>
				<button
					type="button"
					@click="generateSlug"
					class="btn btn-secondary btn-small"
				>
					Auto
				</button>
			</div>
			<p class="form-help">URL-friendly identifier (lowercase letters, numbers, hyphens)</p>
		</div>

		<div class="form-group" v-if="mode === 'create'">
			<label class="form-label">Type</label>
			<div class="type-selector">
				<button
					type="button"
					@click="type = 'solo'"
					:class="['type-btn', { active: type === 'solo' }]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
					Solo
				</button>
				<button
					type="button"
					@click="type = 'team'"
					:class="['type-btn', { active: type === 'team' }]"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
					Team
				</button>
			</div>
		</div>

		<div class="form-group" v-if="mode === 'edit'">
			<label for="status" class="form-label">Status</label>
			<select id="status" v-model="status" class="form-select">
				<option value="draft">Draft</option>
				<option value="registration">Registration Open</option>
				<option value="active">Active</option>
				<option value="completed">Completed</option>
			</select>
		</div>

		<div class="form-group">
			<label for="description" class="form-label">Description (optional)</label>
			<textarea
				id="description"
				v-model="description"
				class="form-textarea"
				rows="3"
				placeholder="Describe this bracket..."
			></textarea>
		</div>

		<div class="form-actions">
			<button
				type="button"
				@click="emit('cancel')"
				class="btn btn-secondary"
			>
				Cancel
			</button>
			<button
				type="submit"
				:disabled="isLoading"
				class="btn btn-primary"
			>
				<span v-if="isLoading" class="spinner"></span>
				<span v-else>{{ mode === 'create' ? 'Create Bracket' : 'Save Changes' }}</span>
			</button>
		</div>
	</form>
</template>

<style scoped>
.bracket-form {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.error-banner {
	padding: 0.75rem 1rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.5rem;
	color: #fca5a5;
	font-size: 0.875rem;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.form-label {
	font-size: 0.875rem;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.8);
}

.form-input,
.form-select,
.form-textarea {
	padding: 0.75rem 1rem;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5rem;
	color: white;
	font-size: 1rem;
	transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
	outline: none;
	border-color: rgba(139, 92, 246, 0.5);
}

.form-input::placeholder,
.form-textarea::placeholder {
	color: rgba(255, 255, 255, 0.3);
}

.form-select {
	cursor: pointer;
}

.form-select option {
	background: #1a1a2e;
	color: white;
}

.form-textarea {
	resize: vertical;
	min-height: 80px;
}

.form-help {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.5);
	margin: 0;
}

.slug-input-group {
	display: flex;
	gap: 0.5rem;
}

.slug-input-group .form-input {
	flex: 1;
}

.type-selector {
	display: flex;
	gap: 0.75rem;
}

.type-btn {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 1rem;
	background: rgba(255, 255, 255, 0.05);
	border: 2px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5rem;
	color: rgba(255, 255, 255, 0.7);
	font-size: 1rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s;
}

.type-btn:hover {
	border-color: rgba(139, 92, 246, 0.3);
}

.type-btn.active {
	background: rgba(139, 92, 246, 0.1);
	border-color: rgba(139, 92, 246, 0.5);
	color: white;
}

.form-actions {
	display: flex;
	gap: 0.75rem;
	justify-content: flex-end;
	padding-top: 0.5rem;
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

.btn-primary {
	background: linear-gradient(135deg, #8b5cf6, #6366f1);
	color: white;
}

.btn-primary:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-secondary {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
}

.btn-small {
	padding: 0.5rem 0.75rem;
	font-size: 0.75rem;
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
