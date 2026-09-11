<template>
	<div v-if="submitted" class="application-success" role="status">
		<h3>Application received</h3>
		<p>David reads every Sprint application and replies either way.</p>
	</div>
	<form v-else class="application-form" @submit.prevent="submit">
		<p v-if="error" class="application-form__error" role="alert">{{ error }}</p>

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

		<label class="application-form__field">
			<span>Company / product</span>
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
			<span>Technical buyer</span>
			<input
				v-model="technicalBuyer"
				type="text"
				name="technicalBuyer"
				required
				placeholder="Who evaluates this, and how to reach them"
				:aria-invalid="Boolean(fieldErrors.technicalBuyer)"
				:disabled="loading"
			/>
			<small v-if="fieldErrors.technicalBuyer" class="application-form__field-error">{{ fieldErrors.technicalBuyer }}</small>
		</label>

		<label class="application-form__field">
			<span>Adoption problem</span>
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
			<span>Links <em>(optional)</em></span>
			<input
				v-model="links"
				type="text"
				name="links"
				:aria-invalid="Boolean(fieldErrors.links)"
				:disabled="loading"
			/>
			<small v-if="fieldErrors.links" class="application-form__field-error">{{ fieldErrors.links }}</small>
		</label>

		<button type="submit" class="editorial-button editorial-button--peach" :disabled="loading">
			{{ loading ? "Sending application..." : "Start with a Fit & Proof Sprint" }}
		</button>
	</form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { actions, isInputError } from "astro:actions";

const FALLBACK_ERROR =
	"We could not send your application. Please email david@rawkode.academy directly.";

const email = ref("");
const company = ref("");
const technicalBuyer = ref("");
const challenge = ref("");
const links = ref("");

const loading = ref(false);
const submitted = ref(false);
const error = ref("");
const fieldErrors = ref<Record<string, string>>({});

async function submit() {
	error.value = "";
	fieldErrors.value = {};
	loading.value = true;

	try {
		const result = await actions.partnership.apply({
			email: email.value,
			company: company.value,
			technicalBuyer: technicalBuyer.value,
			challenge: challenge.value,
			...(links.value.trim() ? { links: links.value } : {}),
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
	color: var(--ctp-mocha-subtext1, var(--editorial-ink-soft));
}

.application-form__field em {
	font-style: normal;
	font-weight: 500;
	color: var(--ctp-mocha-subtext0, var(--editorial-ink-mute));
	text-transform: none;
	letter-spacing: 0.04em;
}

.application-form__field input,
.application-form__field textarea {
	width: 100%;
	border: 1px solid var(--ctp-mocha-surface2, var(--editorial-hairline-strong));
	border-radius: 2px;
	background: var(--ctp-mocha-base, var(--editorial-paper));
	color: var(--ctp-mocha-text, var(--editorial-ink));
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
.application-form__field textarea:focus-visible {
	outline: 2px solid var(--ctp-mocha-lavender, var(--editorial-spruce));
	outline-offset: 1px;
}

.application-form__field input:disabled,
.application-form__field textarea:disabled {
	opacity: 0.6;
}

.application-form__field input[aria-invalid="true"],
.application-form__field textarea[aria-invalid="true"] {
	border-color: var(--ctp-mocha-red, var(--editorial-rust));
}

.application-form__field-error {
	color: var(--ctp-mocha-red, var(--editorial-rust));
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.8rem;
	line-height: 1.4;
}

.application-form__error {
	width: 100%;
	margin: 0;
	border: 1px solid var(--ctp-mocha-red, var(--editorial-rust));
	border-radius: 2px;
	background: var(--ctp-mocha-mantle, var(--editorial-paper-deep));
	color: var(--ctp-mocha-text, var(--editorial-ink));
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.92rem;
	line-height: 1.5;
	padding: 0.75rem 1rem;
}

.application-form :deep(.editorial-button--peach) {
	background: var(--ctp-mocha-peach);
	border-color: var(--ctp-mocha-peach);
	color: var(--ctp-mocha-base);
	border-radius: 2px;
}

.application-form :deep(.editorial-button--peach:hover) {
	background: color-mix(in oklab, var(--ctp-mocha-peach) 88%, white);
	border-color: color-mix(in oklab, var(--ctp-mocha-peach) 88%, white);
	color: var(--ctp-mocha-base);
}

.application-form button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.application-success {
	border: 1px solid var(--ctp-mocha-surface1, var(--editorial-hairline));
	border-radius: 2px;
	background: var(--ctp-mocha-mantle, var(--editorial-paper-deep));
	padding: 1.5rem;
	display: grid;
	gap: 0.5rem;
	width: 100%;
}

.application-success h3 {
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 1.25rem;
	font-weight: 700;
	line-height: 1.1;
	margin: 0;
	color: var(--ctp-mocha-text, var(--editorial-ink));
}

.application-success p {
	margin: 0;
	color: var(--ctp-mocha-subtext1, var(--editorial-ink-soft));
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.95rem;
	line-height: 1.55;
}
</style>
