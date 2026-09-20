<template>
	<div :class="s.root">
		<p role="status" aria-live="polite" aria-atomic="true" :class="ready ? s.hidden : s.copy">{{ statusMessage }}</p>
		<p :id="errorId" role="alert" aria-atomic="true" :class="error ? s.error : s.hidden">{{ error }}</p>
		<div v-if="submitted" :class="[s.panel, s.status]">
			<h3 :class="s.heading">Application received</h3>
			<p :class="s.copy">David reads every application and replies either way.</p>
		</div>
		<form v-else method="POST" :class="s.form" @submit.prevent="submit" :aria-busy="!ready || loading" :aria-describedby="error ? errorId : undefined">
			<fieldset :class="[s.form, 'form-controls']" :disabled="!ready || loading" aria-label="Partnership application">
				<div :class="s.row">
					<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.name)" :disabled="loading">
						<Field.Label :class="s.label">Name</Field.Label>
						<Field.Input :class="s.input"
							v-model="name"
							type="text"
							name="name"
							autocomplete="name"
							required
						/>
						<Field.ErrorText v-if="fieldErrors.name" :class="s.fieldError">{{ fieldErrors.name }}</Field.ErrorText>
					</Field.Root>
					<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.email)" :disabled="loading">
						<Field.Label :class="s.label">Work email</Field.Label>
						<Field.Input :class="s.input"
							v-model="email"
							type="email"
							name="email"
							autocomplete="email"
							required
						/>
						<Field.ErrorText v-if="fieldErrors.email" :class="s.fieldError">{{ fieldErrors.email }}</Field.ErrorText>
					</Field.Root>
				</div>

				<div :class="s.row">
					<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.company)" :disabled="loading">
						<Field.Label :class="s.label">Company and product</Field.Label>
						<Field.Input :class="s.input"
							v-model="company"
							type="text"
							name="company"
							autocomplete="organization"
							required
						/>
						<Field.ErrorText v-if="fieldErrors.company" :class="s.fieldError">{{ fieldErrors.company }}</Field.ErrorText>
					</Field.Root>
					<Field.Root :class="s.field" :disabled="loading">
						<Field.Label :class="s.label">Preferred route</Field.Label>
						<Field.Select v-model="path" name="path" :class="s.input">
							<option v-for="option in applicationPaths" :key="option" :value="option">
								{{ option }}
							</option>
						</Field.Select>
					</Field.Root>
				</div>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.targetDevelopers)" :disabled="loading">
					<Field.Label :class="s.label">The developers or platform teams you need to reach</Field.Label>
					<Field.Input :class="s.input"
						v-model="targetDevelopers"
						type="text"
						name="targetDevelopers"
						required
					/>
					<Field.ErrorText v-if="fieldErrors.targetDevelopers" :class="s.fieldError">{{ fieldErrors.targetDevelopers }}</Field.ErrorText>
				</Field.Root>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.technicalBuyer)" :disabled="loading">
					<Field.Label :class="s.label">Technical buyer <em>(optional)</em></Field.Label>
					<Field.Input :class="s.input"
						v-model="technicalBuyer"
						type="text"
						name="technicalBuyer"
					/>
					<Field.ErrorText v-if="fieldErrors.technicalBuyer" :class="s.fieldError">{{ fieldErrors.technicalBuyer }}</Field.ErrorText>
				</Field.Root>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.challenge)" :disabled="loading">
					<Field.Label :class="s.label">Your current adoption challenge</Field.Label>
					<Field.Textarea :class="[s.input, s.textarea]"
						v-model="challenge"
						name="challenge"
						rows="4"
						required
					/>
					<Field.ErrorText v-if="fieldErrors.challenge" :class="s.fieldError">{{ fieldErrors.challenge }}</Field.ErrorText>
				</Field.Root>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.proofAssets)" :disabled="loading">
					<Field.Label :class="s.label">Working demo, docs, or repository <em>(optional)</em></Field.Label>
					<Field.Input :class="s.input"
						v-model="proofAssets"
						type="text"
						name="proofAssets"
					/>
					<Field.ErrorText v-if="fieldErrors.proofAssets" :class="s.fieldError">{{ fieldErrors.proofAssets }}</Field.ErrorText>
				</Field.Root>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.budgetQuarter)" :disabled="loading">
					<Field.Label :class="s.label">Budget and preferred quarter <em>(optional)</em></Field.Label>
					<Field.Input :class="s.input"
						v-model="budgetQuarter"
						type="text"
						name="budgetQuarter"
						placeholder="For example: Q4 2026, £4k/month"
					/>
					<Field.ErrorText v-if="fieldErrors.budgetQuarter" :class="s.fieldError">{{ fieldErrors.budgetQuarter }}</Field.ErrorText>
				</Field.Root>

				<Field.Root :class="s.field" :invalid="Boolean(fieldErrors.links)" :disabled="loading">
					<Field.Label :class="s.label">Links worth a look <em>(optional)</em></Field.Label>
					<Field.Input :class="s.input" v-model="links" type="text" name="links" />
					<Field.ErrorText v-if="fieldErrors.links" :class="s.fieldError">{{ fieldErrors.links }}</Field.ErrorText>
				</Field.Root>

				<button type="submit" :class="s.button" :disabled="loading">
					{{ loading ? "Sending application..." : "Submit application" }}
				</button>
			</fieldset>
			<p v-if="!ready" :class="s.copy"><noscript>JavaScript is required to send this application. </noscript>You can <a href="mailto:david@rawkode.academy">email David directly</a> instead.</p>
		</form>
	</div>
</template>

<script setup lang="ts">
import { Field } from "@ark-ui/vue/field";
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";
import { academyForms } from "@rawkodeacademy/design-system";

import { actions, isInputError } from "astro:actions";
import { applicationPaths, type ApplicationPath } from "@/lib/partnerships";

const s = academyForms();
const errorId = `${useId()}-error`;

const FALLBACK_ERROR =
	"We could not send your application. Please email david@rawkode.academy directly.";

const name = ref("");
const email = ref("");
const company = ref("");
const path = ref<ApplicationPath>("Not sure yet");
const targetDevelopers = ref("");
const technicalBuyer = ref("");
const challenge = ref("");
const proofAssets = ref("");
const budgetQuarter = ref("");
const links = ref("");

const ready = ref(false);
const loading = ref(false);
const submitted = ref(false);
const error = ref("");
const fieldErrors = ref<Record<string, string>>({});
const statusMessage = computed(() => {
	if (!ready.value) return "Loading application form...";
	if (submitted.value) return "Application received. David reads every application and replies either way.";
	return loading.value ? "Sending application..." : "";
});

const isApplicationPath = (value: string): value is ApplicationPath =>
	(applicationPaths as readonly string[]).includes(value);

// Package CTAs carry the route in the URL so the selection survives the
// client:visible hydration gap, and also retain data-apply-path for clicks
// after hydration.
const onDocumentClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement | null;
	const trigger = target?.closest<HTMLElement>("[data-apply-path]");
	const value = trigger?.dataset.applyPath;
	if (value && isApplicationPath(value)) {
		path.value = value;
	}
};

onMounted(() => {
	ready.value = true;
	const route = new URLSearchParams(window.location.search).get("route");
	if (route && isApplicationPath(route)) {
		path.value = route;
	}
	document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
	document.removeEventListener("click", onDocumentClick);
});

async function submit() {
	if (!ready.value || loading.value) return;
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
			...(technicalBuyer.value.trim() ? { technicalBuyer: technicalBuyer.value } : {}),
			challenge: challenge.value,
			...(proofAssets.value.trim() ? { proofAssets: proofAssets.value } : {}),
			...(budgetQuarter.value.trim() ? { budgetQuarter: budgetQuarter.value } : {}),
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
.form-controls {
	margin: 0;
	padding: 0;
	border: 0;
	min-inline-size: 0;
}
</style>
