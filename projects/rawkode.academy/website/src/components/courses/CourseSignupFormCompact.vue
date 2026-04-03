<template>
  <div class="space-y-4">
    <!-- Checking Subscription -->
    <div v-if="checkingSubscription" class="py-2 text-center">
      <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p class="text-sm text-secondary-content">Checking subscription...</p>
    </div>

    <!-- Already Subscribed -->
    <div v-else-if="isAlreadySubscribed" class="py-2 text-center">
      <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 class="mb-2 text-lg font-semibold text-primary-content">You're subscribed</h4>
      <p class="text-sm text-secondary-content">
        We'll notify you when new content is available.
      </p>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="py-2 text-center">
      <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 class="mb-2 text-lg font-semibold text-primary-content">Thanks for signing up</h4>
      <p class="text-sm text-secondary-content">
        {{ successMessage || 'Check your email to confirm your subscription.' }}
      </p>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitForm" class="space-y-4">
      <div v-if="error" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
        {{ error }}
      </div>

      <div v-if="!userEmail">
        <input
          v-model="email"
          type="email"
          id="email"
          placeholder="Enter your email"
          required
          class="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-primary-content placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-gray-950/35"
          :disabled="loading"
        />
      </div>

      <div
        v-if="signupConfig.sponsor && signupConfig.allowSponsorContact"
        class="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 dark:border-white/8 dark:bg-gray-950/25"
      >
        <div class="flex items-start gap-3">
        <input
          v-model="sponsorConsent"
          type="checkbox"
          id="sponsor-consent"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          :disabled="loading"
        />
        <label for="sponsor-consent" class="text-sm leading-6 text-secondary-content">
          I agree to share my email with {{ signupConfig.sponsor }} for course-related updates
        </label>
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-3 font-semibold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span v-if="loading" class="flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
