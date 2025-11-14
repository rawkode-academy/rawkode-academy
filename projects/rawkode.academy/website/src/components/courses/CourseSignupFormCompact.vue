<template>
  <div>
    <!-- Checking Subscription -->
    <div v-if="checkingSubscription" class="text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700/50 mb-4">
        <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p class="text-gray-400 text-sm">Checking subscription...</p>
    </div>

    <!-- Already Subscribed -->
    <div v-else-if="isAlreadySubscribed" class="text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 class="text-lg font-semibold text-white mb-2">You're Subscribed!</h4>
      <p class="text-gray-400 text-sm">
        We'll notify you when new content is available.
      </p>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h4 class="text-lg font-semibold text-white mb-2">Thank You!</h4>
      <p class="text-gray-400 text-sm">
        {{ successMessage || 'Check your email to confirm your subscription.' }}
      </p>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitForm" class="space-y-4">
      <div v-if="error" class="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
        {{ error }}
      </div>

      <div v-if="!userEmail">
        <input
          v-model="email"
          type="email"
          id="email"
          placeholder="Enter your email"
          required
          class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          :disabled="loading"
        />
      </div>

      <div v-if="signupConfig.sponsor && signupConfig.allowSponsorContact" class="flex items-start gap-3">
        <input
          v-model="sponsorConsent"
          type="checkbox"
          id="sponsor-consent"
          class="mt-1 w-4 h-4 text-primary bg-gray-900 border-gray-600 rounded focus:ring-primary focus:ring-2"
          :disabled="loading"
        />
        <label for="sponsor-consent" class="text-sm text-gray-400">
          I agree to share my email with {{ signupConfig.sponsor }} for course-related updates
        </label>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center"
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

interface Props {
	courseId: string;
	courseTitle: string;
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

async function submitForm() {
	error.value = "";
	loading.value = true;

	try {
		// Create FormData object since the action expects FormData
		const formData = new FormData();
		formData.append("audienceId", props.signupConfig.audienceId);
		formData.append("email", email.value || props.userEmail || "");
		formData.append("allowSponsorContact", sponsorConsent.value.toString());
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