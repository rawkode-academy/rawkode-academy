<template>
  <div>
    <!-- Checking Subscription -->
    <div v-if="checkingSubscription" :class="css({ textAlign: 'center' })">
      <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', borderRadius: 'full', bg: 'gray.700/50', mb: '4' })">
        <svg :class="css({ animation: 'spin', h: '8', w: '8', color: 'teal.500' })" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle :class="css({ opacity: '0.25' })" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path :class="css({ opacity: '0.75' })" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p :class="css({ color: 'gray.400', fontSize: 'sm' })">Checking subscription...</p>
    </div>

    <!-- Already Subscribed -->
    <div v-else-if="isAlreadySubscribed" :class="css({ textAlign: 'center' })">
      <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', borderRadius: 'full', bg: 'green.500/20', mb: '4' })">
        <svg xmlns="http://www.w3.org/2000/svg" :class="css({ h: '8', w: '8', color: 'green.400' })" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 :class="css({ fontSize: 'lg', fontWeight: 'semibold', color: 'white', mb: '2' })">You're Subscribed!</h4>
      <p :class="css({ color: 'gray.400', fontSize: 'sm' })">
        We'll notify you when new content is available.
      </p>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" :class="css({ textAlign: 'center' })">
      <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', borderRadius: 'full', bg: 'green.500/20', mb: '4' })">
        <svg xmlns="http://www.w3.org/2000/svg" :class="css({ h: '8', w: '8', color: 'green.400' })" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 :class="css({ fontSize: 'lg', fontWeight: 'semibold', color: 'white', mb: '2' })">Thank You!</h4>
      <p :class="css({ color: 'gray.400', fontSize: 'sm' })">
        {{ successMessage || 'Check your email to confirm your subscription.' }}
      </p>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitForm" :class="css({ display: 'flex', flexDirection: 'column', gap: '4' })">
      <div v-if="error" :class="css({ p: '3', bg: 'red.500/20', borderWidth: '1px', borderColor: 'red.500/30', borderRadius: 'lg', color: 'red.300', fontSize: 'sm' })">
        {{ error }}
      </div>

      <div v-if="!userEmail">
        <input
          v-model="email"
          type="email"
          id="email"
          placeholder="Enter your email"
          required
          :class="css({ w: 'full', px: '4', py: '3', bg: 'gray.900/50', borderWidth: '1px', borderColor: 'gray.600', borderRadius: 'lg', color: 'white', _placeholder: { color: 'gray.500' }, _focus: { outline: 'none', ringWidth: '2px', ringColor: 'teal.500', borderColor: 'transparent' }, _disabled: { opacity: '0.5' } })"
          :disabled="loading"
        />
      </div>

      <div v-if="signupConfig.sponsor && signupConfig.allowSponsorContact" :class="css({ display: 'flex', alignItems: 'flex-start', gap: '3' })">
        <input
          v-model="sponsorConsent"
          type="checkbox"
          id="sponsor-consent"
          :class="css({ mt: '1', w: '4', h: '4', borderRadius: 'sm', borderColor: 'gray.600', bg: 'gray.900' })"
          :disabled="loading"
        />
        <label for="sponsor-consent" :class="css({ fontSize: 'sm', color: 'gray.400' })">
          I agree to share my email with {{ signupConfig.sponsor }} for course-related updates
        </label>
      </div>

      <button
        type="submit"
        :disabled="loading"
        :class="css({ w: 'full', py: '3', px: '4', bg: 'teal.500', color: 'white', fontWeight: 'semibold', borderRadius: 'lg', transition: 'colors', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', _hover: { bg: 'teal.600' }, _disabled: { bg: 'gray.700', cursor: 'not-allowed' } })"
      >
        <span v-if="loading" :class="css({ display: 'flex', alignItems: 'center' })">
          <svg :class="css({ animation: 'spin', ml: '-1', mr: '3', h: '5', w: '5', color: 'white' })" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle :class="css({ opacity: '0.25' })" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path :class="css({ opacity: '0.75' })" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Subscribing...
        </span>
        <span v-else>
          {{ userEmail ? 'Subscribe to Updates' : 'Get Course Updates' }}
        </span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { css } from "../../styled-system/css";
import { actions } from "astro:actions";
import {
	getSessionCampaignAttribution,
	serializeCampaignAttribution,
} from "@/lib/analytics/attribution";

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
const loading = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");
const isAlreadySubscribed = ref(props.isAlreadySubscribed ?? false);
const checkingSubscription = ref(false);

// Optionally check subscription status on mount if deferred
onMounted(async () => {
	if (props.deferSubscriptionCheck && props.isAlreadySubscribed === undefined) {
		checkingSubscription.value = true;
		try {
			const response = await fetch(
				`/api/subscriptions/check?audienceId=${encodeURIComponent(props.signupConfig.audienceId)}`,
			);
			if (response.ok) {
				const data = await response.json();
				isAlreadySubscribed.value = data.isSubscribed;
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
		} else if (result.data) {
			submitted.value = true;
			successMessage.value = result.data.message;
		}
	} catch (err: any) {
		error.value = err.message || "An error occurred. Please try again.";
	} finally {
		loading.value = false;
	}
}
</script>
