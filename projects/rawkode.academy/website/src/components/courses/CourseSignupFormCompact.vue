<template>
	<div :class="[s.root, s.stack]">
		<p role="status" aria-live="polite" aria-atomic="true" :class="ready ? s.hidden : s.copy">{{ statusMessage }}</p>
		<p :id="errorId" role="alert" aria-atomic="true" :class="error ? s.error : s.hidden">{{ error }}</p>
		<div v-if="checkingSubscription" :class="s.status">
			<p :class="s.copy">Checking subscription...</p>
		</div>
		<div v-else-if="isAlreadySubscribed && !submitted" :class="s.status">
			<h4 :class="s.heading">You're subscribed</h4>
			<p :class="s.copy">We'll notify you when new content is available.</p>
		</div>
		<div v-else-if="submitted" :class="s.status">
			<h4 :class="s.heading">Thanks for signing up</h4>
			<p :class="s.copy">{{ successMessage || 'Course updates are saved.' }}</p>
		</div>
		<form v-if="!checkingSubscription && (!courseSaved || canOfferSponsor)" method="POST" @submit.prevent="submitForm" :class="s.form" :aria-busy="!ready || loading" :aria-describedby="error ? errorId : undefined">
			<fieldset :class="[s.form, 'form-controls']" :disabled="!ready || loading" aria-label="Course update signup">
				<div v-if="!userEmail" :class="s.field">
					<label :for="emailId" :class="s.label">Email address</label>
					<input v-model="email" :id="emailId" type="email" name="email" autocomplete="email" placeholder="Enter your email" required :class="s.input" :disabled="loading" :readonly="submitted" />
				</div>
				<p v-if="courseSaved" :class="s.copy">Course updates are saved. Sponsor contact is optional; select the checkbox and submit only if you want to request it.</p>
				<div v-if="canOfferSponsor" :class="s.courseConsent">
					<input v-model="sponsorConsent" :id="consentId" type="checkbox" name="allowSponsorContact" :class="s.checkbox" :disabled="loading" />
					<label :for="consentId" :class="s.copy">Optional: share my email with {{ signupConfig.sponsor }} so they can contact me with relevant offers and product updates.</label>
				</div>
				<button type="submit" :disabled="loading || (courseSaved && !sponsorConsent)" :class="s.button">{{ loading ? 'Submitting...' : courseSaved ? (sponsorStatus === 'unconfirmed' ? 'Retry sponsor signup' : 'Request sponsor contact') : 'Sign Up for Updates' }}</button>
			</fieldset>
			<noscript :class="s.copy">JavaScript is required to sign up for course updates. Course content remains available without signing up.</noscript>
		</form>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, useId } from "vue";
import { academyForms } from "@rawkodeacademy/design-system";

import { actions } from "astro:actions";
import {
	getSessionCampaignAttribution,
	serializeCampaignAttribution,
} from "@/lib/analytics/attribution";

const s = academyForms();
const id = useId();
const emailId = `${id}-email`;
const consentId = `${id}-consent`;
const errorId = `${id}-error`;

interface Props {
	courseId: string;
	courseTitle: string;
	pagePath: string;
	signupConfig: {
		audienceId: string;
		sponsor?: string;
		sponsorAudienceId?: string;
		allowSponsorContact: boolean;
	};
	userEmail?: string | undefined;
	isAlreadySubscribed?: boolean | undefined;
	deferSubscriptionCheck?: boolean | undefined;
}

const props = defineProps<Props>();

const email = ref(props.userEmail || "");
const sponsorConsent = ref(false);
const ready = ref(false);
const loading = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");
const isAlreadySubscribed = ref(props.isAlreadySubscribed ?? false);
const checkingSubscription = ref(false);
const sponsorStatus = ref<"not_requested" | "subscribed" | "unconfirmed">("not_requested");
const courseSaved = computed(() => isAlreadySubscribed.value || submitted.value);
const canOfferSponsor = computed(() => Boolean(
	props.signupConfig.allowSponsorContact && props.signupConfig.sponsor && props.signupConfig.sponsorAudienceId &&
	sponsorStatus.value !== "subscribed",
));
const statusMessage = computed(() => {
	if (!ready.value && !isAlreadySubscribed.value) return "Loading signup form...";
	if (checkingSubscription.value) return "Checking subscription status...";
	if (loading.value) return "Submitting your subscription...";
	if (submitted.value) return successMessage.value || "Course updates are saved.";
	if (isAlreadySubscribed.value) return "You're subscribed to course updates.";
	return "";
});

// Optionally check subscription status on mount if deferred
onMounted(async () => {
	ready.value = true;
	if (props.deferSubscriptionCheck && props.isAlreadySubscribed === undefined) {
		checkingSubscription.value = true;
		try {
			const response = await fetch(
				`/api/subscriptions/check?audienceId=${encodeURIComponent(props.signupConfig.audienceId)}`,
			);
			if (response.ok) {
				const data: unknown = await response.json();
				if (
					typeof data === "object" && data !== null &&
					"isSubscribed" in data && typeof data.isSubscribed === "boolean"
				) {
					isAlreadySubscribed.value = data.isSubscribed;
				}
			}
		} catch (err) {
			// Silently fail - user can still subscribe if check fails
			console.error("Failed to check subscription status:", err);
		} finally {
			checkingSubscription.value = false;
		}
	}
});

function createSource(): string {
	return `website:course-signup:${props.courseId}:${props.pagePath}`;
}

function createAttributionPayload(): string | undefined {
	return serializeCampaignAttribution(getSessionCampaignAttribution());
}

async function submitForm() {
	if (!ready.value || loading.value) return;
	if (courseSaved.value && (!canOfferSponsor.value || !sponsorConsent.value)) return;
	error.value = "";
	loading.value = true;

	try {
		// Create FormData object since the action expects FormData
		const formData = new FormData();
		formData.append("audienceId", props.signupConfig.audienceId);
		formData.append("email", email.value || props.userEmail || "");
		formData.append("allowSponsorContact", sponsorConsent.value.toString());
		formData.append("source", createSource());
		const attribution = createAttributionPayload();
		if (attribution) {
			formData.append("attribution", attribution);
		}
		if (props.signupConfig.sponsorAudienceId) {
			formData.append(
				"sponsorAudienceId",
				props.signupConfig.sponsorAudienceId,
			);
		}

		const result = await actions.signupForCourseUpdates(formData);

		if (result.error) {
			error.value = result.error.message || "An error occurred";
		} else if (result.data?.success) {
			submitted.value = true;
			successMessage.value = result.data.message;
			sponsorStatus.value = result.data.sponsorStatus ?? "not_requested";
			sponsorConsent.value = false;
		} else {
			error.value = "Subscription could not be confirmed. Please try again.";
		}
	} catch (err: any) {
		error.value = err.message || "An error occurred. Please try again.";
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
