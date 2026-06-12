<template>
	<div v-if="submitted" class="application-success" role="status">
		<h3>Application received</h3>
		<p>David reads every application and replies either way.</p>
	</div>
	<form v-else class="application-form" @submit.prevent="submit">
		<p v-if="error" class="application-form__error" role="alert">{{ error }}</p>

		<div class="application-form__row application-form__row--split">
			<label class="application-form__field">
				<span>Name</span>
				<input
					v-model="name"
					type="text"
					name="name"
					autocomplete="name"
					required
					:aria-invalid="Boolean(fieldErrors.name)"
					:disabled="loading"
				/>
				<small v-if="fieldErrors.name" class="application-form__field-error">{{ fieldErrors.name }}</small>
			</label>
			<label class="application-form__field">
				<span>Work email</span>
				<input
					v-model="email"
					type="email"
					name="email"
					autocomplete="email"
					required
					:aria-invalid="Boolean(fieldErrors.email)"
					:disabled="loading"
				/>
				<small v-if="fieldErrors.email" class="application-form__field-error">{{ fieldErrors.email }}</small>
			</label>
		</div>

		<div class="application-form__row application-form__row--split">
			<label class="application-form__field">
				<span>Company and product</span>
				<input
					v-model="company"
					type="text"
					name="company"
					autocomplete="organization"
					required
					:aria-invalid="Boolean(fieldErrors.company)"
					:disabled="loading"
				/>
				<small v-if="fieldErrors.company" class="application-form__field-error">{{ fieldErrors.company }}</small>
			</label>
			<label class="application-form__field">
				<span>Preferred plan</span>
				<select v-model="path" name="path" :disabled="loading">
					<option v-for="option in applicationPaths" :key="option" :value="option">
						{{ option }}
					</option>
				</select>
			</label>
		</div>

		<label class="application-form__field">
			<span>The developers or platform teams you need to reach</span>
			<input
				v-model="targetDevelopers"
				type="text"
				name="targetDevelopers"
				required
				:aria-invalid="Boolean(fieldErrors.targetDevelopers)"
				:disabled="loading"
			/>
			<small v-if="fieldErrors.targetDevelopers" class="application-form__field-error">{{ fieldErrors.targetDevelopers }}</small>
		</label>

		<label class="application-form__field">
			<span>Your current adoption challenge</span>
			<textarea
				v-model="challenge"
				name="challenge"
				rows="4"
				required
				:aria-invalid="Boolean(fieldErrors.challenge)"
				:disabled="loading"
			></textarea>
			<small v-if="fieldErrors.challenge" class="application-form__field-error">{{ fieldErrors.challenge }}</small>
		</label>

		<label class="application-form__field">
			<span>Links worth a look <em>(optional)</em></span>
			<input v-model="links" type="text" name="links" :aria-invalid="Boolean(fieldErrors.links)" :disabled="loading" />
			<small v-if="fieldErrors.links" class="application-form__field-error">{{ fieldErrors.links }}</small>
		</label>

		<div class="application-form__trap" aria-hidden="true">
			<label>
				Website
				<input
					v-model="website"
					type="text"
					name="website"
					tabindex="-1"
					autocomplete="off"
				/>
			</label>
		</div>

		<button type="submit" class="editorial-button" :disabled="loading">
			{{ loading ? "Sending application..." : "Submit application" }}
		</button>
	</form>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { actions, isInputError } from "astro:actions";
import { applicationPaths, type ApplicationPath } from "@/lib/partnerships";

const FALLBACK_ERROR =
	"We could not send your application. Please email david@rawkode.academy directly.";

const name = ref("");
const email = ref("");
const company = ref("");
const path = ref<ApplicationPath>("Not sure yet");
const targetDevelopers = ref("");
const challenge = ref("");
const links = ref("");
const website = ref("");

const loading = ref(false);
const submitted = ref(false);
const error = ref("");
const fieldErrors = ref<Record<string, string>>({});

const isApplicationPath = (value: string): value is ApplicationPath =>
	(applicationPaths as readonly string[]).includes(value);

// Package CTAs are plain anchors carrying data-apply-path; clicking one
// scrolls to this form and preselects the plan.
const onDocumentClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement | null;
	const trigger = target?.closest<HTMLElement>("[data-apply-path]");
	const value = trigger?.dataset.applyPath;
	if (value && isApplicationPath(value)) {
		path.value = value;
	}
};

onMounted(() => {
	document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
	document.removeEventListener("click", onDocumentClick);
});

async function submit() {
	error.value = "";
	fieldErrors.value = {};
	loading.value = true;

	try {
		const result = await actions.partnership.apply({
			name: name.value,
			email: email.value,
			company: company.value,
			path: path.value,
			targetDevelopers: targetDevelopers.value,
			challenge: challenge.value,
			...(links.value.trim() ? { links: links.value } : {}),
			...(website.value ? { website: website.value } : {}),
		});

		if (result.error) {
			if (isInputError(result.error)) {
				fieldErrors.value = Object.fromEntries(
					Object.entries(result.error.fields).map(([field, messages]) => [
						field,
						messages?.[0] ?? "Please check this field",
					]),
				);
				error.value = "Please check the highlighted fields.";
			} else {
				error.value = result.error.message || FALLBACK_ERROR;
			}
		} else {
			submitted.value = true;
		}
	} catch {
		error.value = FALLBACK_ERROR;
	} finally {
		loading.value = false;
	}
}
</script>

<style scoped>
.application-form {
	display: grid;
	gap: 1rem;
	justify-items: start;
}

.application-form__row {
	display: grid;
	gap: 1rem;
	width: 100%;
}

.application-form__field {
	display: grid;
	gap: 0.4rem;
	width: 100%;
}

.application-form__field span {
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.7rem;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--editorial-ink-soft);
}

.application-form__field em {
	font-style: normal;
	font-weight: 500;
	color: var(--editorial-ink-mute);
	text-transform: none;
	letter-spacing: 0.04em;
}

.application-form__field input,
.application-form__field select,
.application-form__field textarea {
	width: 100%;
	border: 1px solid var(--editorial-hairline-strong);
	border-radius: 4px;
	background: var(--editorial-paper);
	color: var(--editorial-ink);
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.95rem;
	line-height: 1.4;
	padding: 0.65rem 0.75rem;
}

.application-form__field textarea {
	resize: vertical;
	min-height: 6rem;
}

.application-form__field input:focus-visible,
.application-form__field select:focus-visible,
.application-form__field textarea:focus-visible {
	outline: 2px solid var(--editorial-spruce);
	outline-offset: 1px;
}

.application-form__field input:disabled,
.application-form__field select:disabled,
.application-form__field textarea:disabled {
	opacity: 0.6;
}

.application-form__field input[aria-invalid="true"],
.application-form__field textarea[aria-invalid="true"] {
	border-color: var(--editorial-rust);
}

.application-form__field-error {
	color: var(--editorial-rust);
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.8rem;
	line-height: 1.4;
}

.application-form__error {
	width: 100%;
	margin: 0;
	border: 1px solid var(--editorial-rust);
	border-radius: 4px;
	background: var(--editorial-paper-deep);
	color: var(--editorial-ink);
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.92rem;
	line-height: 1.5;
	padding: 0.75rem 1rem;
}

.application-form__trap {
	position: absolute;
	left: -9999px;
	width: 1px;
	height: 1px;
	overflow: hidden;
}

.application-form button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.application-success {
	border: 1px solid var(--editorial-hairline);
	border-radius: 6px;
	background: var(--editorial-paper-deep);
	padding: 1.5rem;
	display: grid;
	gap: 0.5rem;
}

.application-success h3 {
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 1.25rem;
	font-weight: 700;
	line-height: 1.1;
	margin: 0;
	color: var(--editorial-ink);
}

.application-success p {
	margin: 0;
	color: var(--editorial-ink-soft);
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.95rem;
	line-height: 1.55;
}

@media (min-width: 720px) {
	.application-form__row--split {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}
</style>
