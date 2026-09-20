<template>
	<section :class="[s.root, s.section]" :aria-labelledby="titleId">
		<div :class="s.split">
			<div :class="s.stack">
				<p :class="s.kicker">Course Updates</p>
				<h2 :id="titleId" :class="s.title">Stay updated as this course grows</h2>
				<p :class="s.copy">Sign up once and we’ll send new modules, course notes, and supporting material as they ship.</p>
			</div>
			<div :class="s.panel">
				<p role="status" aria-live="polite" aria-atomic="true" :class="ready ? s.hidden : s.copy">{{ statusMessage }}</p>
				<p :id="errorId" role="alert" aria-atomic="true" :class="error ? s.error : s.hidden">{{ error }}</p>
				<div v-if="checkingSubscription" :class="s.status">
					<p :class="s.copy">Checking subscription status...</p>
				</div>
				<div v-else-if="isAlreadySubscribed" :class="s.status">
					<h3 :class="s.heading">You're already subscribed!</h3>
					<p :class="s.copy">You're already receiving updates for this course. We'll notify you as soon as new content is available.</p>
				</div>
				<div v-else-if="submitted" :class="s.status">
					<h3 :class="s.heading">Thank you!</h3>
					<p :class="s.copy">{{ successMessage || "Thank you for signing up! We'll notify you when new course content is available." }}</p>
				</div>
				<form v-else method="POST" @submit.prevent="submitForm" :class="s.form" :aria-busy="!ready || submitting" :aria-describedby="error ? errorId : undefined">
					<fieldset :class="[s.form, 'form-controls']" :disabled="!ready || submitting" aria-label="Course update signup">
						<p :class="s.copy">Sign up to receive notifications when new content is available for this course.</p>
						<div v-if="!userEmail" :class="s.field">
							<label :for="emailId" :class="s.label">Email address</label>
							<input v-model="email" :id="emailId" type="email" name="email" autocomplete="email" required placeholder="your@email.com" :class="s.input" :disabled="submitting" />
						</div>
						<p v-if="disclaimer" :class="s.notice">{{ disclaimer }}</p>
						<div v-if="allowSponsorContact && sponsor" :class="s.consent">
							<input v-model="sponsorContact" :id="consentId" type="checkbox" name="allowSponsorContact" value="true" :class="s.checkbox" :disabled="submitting" />
							<label :for="consentId" :class="s.copy">I agree to allow {{ sponsor }} to contact me with relevant offers and product updates.</label>
						</div>
						<button type="submit" :disabled="submitting" :class="s.button">{{ submitting ? 'Submitting...' : (userEmail ? 'Register for Updates' : 'Sign Up for Updates') }}</button>
					</fieldset>
					<noscript :class="s.copy">JavaScript is required to sign up for course updates. Course content remains available without signing up.</noscript>
				</form>
			</div>
		</div>
	</section>
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
const titleId = `${id}-title`;
const emailId = `${id}-email`;
const consentId = `${id}-consent`;
const errorId = `${id}-error`;

interface Props {
	courseId: string;
	courseTitle: string;
	audienceId: string;
	pagePath: string;
	sponsor?: string | undefined;
	sponsorAudienceId?: string | undefined;
	allowSponsorContact: boolean;
	userEmail?: string | undefined;
	isAlreadySubscribed?: boolean | undefined;
	deferSubscriptionCheck?: boolean | undefined;
}

const props = defineProps<Props>();

const email = ref(props.userEmail || "");
const sponsorContact = ref(false);
const ready = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");
const isAlreadySubscribed = ref(props.isAlreadySubscribed ?? false);
const checkingSubscription = ref(false);
const statusMessage = computed(() => {
	if (!ready.value && !isAlreadySubscribed.value) return "Loading signup form...";
	if (checkingSubscription.value) return "Checking subscription status...";
	if (isAlreadySubscribed.value) return "You're already subscribed to course updates.";
	if (submitted.value) return successMessage.value || "Thank you for signing up! We'll notify you when new course content is available.";
	return submitting.value ? "Submitting your subscription..." : "";
});

const disclaimer = props.sponsor
	? "By signing up, you agree to receive course updates and notifications."
	: null;

// Optionally check subscription status on mount if deferred
onMounted(async () => {
	ready.value = true;
	if (props.deferSubscriptionCheck && props.isAlreadySubscribed === undefined) {
		checkingSubscription.value = true;
		try {
			const response = await fetch(
				`/api/subscriptions/check?audienceId=${encodeURIComponent(props.audienceId)}`,
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
	if (!ready.value || submitting.value) return;
	error.value = "";
	submitting.value = true;

	try {
		// Create FormData object since the action expects FormData
		const formData = new FormData();
		formData.append("audienceId", props.audienceId);
		formData.append("email", email.value || props.userEmail || "");
		formData.append("allowSponsorContact", sponsorContact.value.toString());
		formData.append("source", createSource());
		const attribution = createAttributionPayload();
		if (attribution) {
			formData.append("attribution", attribution);
		}
		if (props.sponsorAudienceId) {
			formData.append("sponsorAudienceId", props.sponsorAudienceId);
		}

		const result = await actions.signupForCourseUpdates(formData);

		if (result.error) {
			error.value = result.error.message || "An error occurred";
		} else if (result.data) {
			submitted.value = true;
			successMessage.value = result.data.message;
		}
	} catch (err: any) {
		error.value =
			err.message || "An error occurred while processing your request";
	} finally {
		submitting.value = false;
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
