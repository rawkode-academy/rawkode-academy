<template>
  <div class="mt-16 max-w-2xl mx-auto">
    <H2Highlight title="Stay Updated" highlightWords="Updated" />

    <div class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
      <!-- Already Subscribed -->
      <div v-if="isAlreadySubscribed" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">You're Already Subscribed!</h3>
        <p class="text-lg text-gray-700 dark:text-gray-300">
          You're already receiving updates for this course. We'll notify you as soon as new content is available.
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="submitted" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Thank You!</h3>
        <p class="text-lg text-gray-700 dark:text-gray-300 mb-6">
          {{ successMessage || 'Thank you for signing up! We\'ll notify you when new course content is available.' }}
        </p>
      </div>

      <!-- Form -->
      <template v-else>
        <p class="text-gray-700 dark:text-gray-300 mb-6 text-center">
          Sign up to receive notifications when new content is available for this course.
        </p>

        <div v-if="error" class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300">
          <p class="font-medium">Error: {{ error }}</p>
        </div>

        <form @submit.prevent="submitForm" class="space-y-4">
          <div v-if="!userEmail">
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email address
            </label>
            <input
              v-model="email"
              type="email"
              id="email"
              name="email"
              required
              placeholder="your@email.com"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div v-if="disclaimer" class="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
            <p>{{ disclaimer }}</p>
          </div>

          <div v-if="allowSponsorContact && sponsor" class="flex items-start">
            <input
              v-model="sponsorContact"
              type="checkbox"
              id="sponsor-contact"
              name="allowSponsorContact"
              value="true"
              class="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label for="sponsor-contact" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              I agree to allow {{ sponsor }} to contact me with relevant offers and product updates.
            </label>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {{ submitting ? 'Submitting...' : (userEmail ? 'Register for Updates' : 'Sign Up for Updates') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { actions } from "astro:actions";
import H2Highlight from "@/components/title/h2-highlight.vue";

interface Props {
	courseId: string;
	courseTitle: string;
	audienceId: string;
	sponsor?: string | undefined;
	sponsorAudienceId?: string | undefined;
	allowSponsorContact: boolean;
	userEmail?: string | undefined;
	isAlreadySubscribed?: boolean | undefined;
}

const props = defineProps<Props>();

const email = ref(props.userEmail || "");
const sponsorContact = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");

const disclaimer = props.sponsor
	? "By signing up, you agree to receive course updates and notifications."
	: null;

async function submitForm() {
	error.value = "";
	submitting.value = true;

	try {
		// Create FormData object since the action expects FormData
		const formData = new FormData();
		formData.append("audienceId", props.audienceId);
		formData.append("email", email.value || props.userEmail || "");
		formData.append("allowSponsorContact", sponsorContact.value.toString());
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