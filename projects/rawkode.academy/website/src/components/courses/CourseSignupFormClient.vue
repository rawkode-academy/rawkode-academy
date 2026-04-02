<template>
  <div :class="css({ mt: '16', maxW: '2xl', mx: 'auto' })">
    <H2Highlight title="Stay Updated" highlightWords="Updated" />

    <div :class="css({ bg: { base: 'white', _dark: 'gray.800' }, p: '8', rounded: 'xl', shadow: 'lg', borderWidth: '1px', borderColor: { base: 'gray.200/50', _dark: 'gray.700/50' } })">
      <!-- Checking Subscription -->
      <div v-if="checkingSubscription" :class="css({ textAlign: 'center', py: '8' })">
        <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', rounded: 'full', bg: { base: 'gray.100', _dark: 'gray.700' }, mb: '6' })">
          <svg :class="[css({ h: '8', w: '8' }), 'animate-spin text-primary']" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle :class="css({ opacity: '0.25' })" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path :class="css({ opacity: '0.75' })" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-secondary-content" :class="css({ fontSize: 'lg' })">Checking subscription status...</p>
      </div>

      <!-- Already Subscribed -->
      <div v-else-if="isAlreadySubscribed" :class="css({ textAlign: 'center', py: '8' })">
        <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', rounded: 'full', bg: { base: 'primary/10', _dark: 'primary/20' }, mb: '6' })">
          <svg xmlns="http://www.w3.org/2000/svg" :class="[css({ h: '8', w: '8' }), 'text-primary']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-primary-content" :class="css({ fontSize: '2xl', fontWeight: 'bold', mb: '3' })">You're Already Subscribed!</h3>
        <p class="text-secondary-content" :class="css({ fontSize: 'lg' })">
          You're already receiving updates for this course. We'll notify you as soon as new content is available.
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="submitted" :class="css({ textAlign: 'center', py: '8' })">
        <div :class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '16', h: '16', rounded: 'full', bg: { base: 'green.100', _dark: 'green.900/30' }, mb: '6' })">
          <svg xmlns="http://www.w3.org/2000/svg" :class="css({ h: '8', w: '8', color: { base: 'green.600', _dark: 'green.400' } })" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 class="text-primary-content" :class="css({ fontSize: '2xl', fontWeight: 'bold', mb: '3' })">Thank You!</h3>
        <p class="text-secondary-content" :class="css({ fontSize: 'lg', mb: '6' })">
          {{ successMessage || 'Thank you for signing up! We\'ll notify you when new course content is available.' }}
        </p>
      </div>

      <!-- Form -->
      <template v-else>
        <p class="text-secondary-content" :class="css({ mb: '6', textAlign: 'center' })">
          Sign up to receive notifications when new content is available for this course.
        </p>

        <div v-if="error" :class="css({ mb: '6', p: '4', bg: { base: 'red.100', _dark: 'red.900/30' }, borderWidth: '1px', borderColor: { base: 'red.200', _dark: 'red.800' }, rounded: 'lg', color: { base: 'red.800', _dark: 'red.300' } })">
          <p :class="css({ fontWeight: 'medium' })">Error: {{ error }}</p>
        </div>

        <form @submit.prevent="submitForm" :class="css({ display: 'flex', flexDirection: 'column', gap: '4' })">
          <div v-if="!userEmail">
            <label for="email" :class="[css({ display: 'block', fontSize: 'sm', fontWeight: 'medium', mb: '2' }), 'text-secondary-content']">
              Email address
            </label>
            <input
              v-model="email"
              type="email"
              id="email"
              name="email"
              required
              placeholder="your@email.com"
              :class="[css({ w: 'full', px: '4', py: '2', borderWidth: '1px', borderColor: { base: 'gray.300', _dark: 'gray.600' }, rounded: 'lg', bg: { base: 'white', _dark: 'gray.700' }, _focus: { ring: '2px', ringColor: 'primary', borderColor: 'primary' } }), 'text-primary-content']"
            />
          </div>

          <div v-if="disclaimer" :class="[css({ fontSize: 'sm', bg: { base: 'gray.50', _dark: 'gray.900' }, p: '3', rounded: 'lg' }), 'text-muted']">
            <p>{{ disclaimer }}</p>
          </div>

          <div v-if="allowSponsorContact && sponsor" :class="css({ display: 'flex', alignItems: 'start' })">
            <input
              v-model="sponsorContact"
              type="checkbox"
              id="sponsor-contact"
              name="allowSponsorContact"
              value="true"
              :class="css({ mt: '1', h: '4', w: '4', borderColor: 'gray.300', rounded: 'sm', _focus: { ring: '2px', ringColor: 'primary' } })"
            />
            <label for="sponsor-contact" :class="[css({ ml: '2', fontSize: 'sm' }), 'text-secondary-content']">
              I agree to allow {{ sponsor }} to contact me with relevant offers and product updates.
            </label>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            :class="css({ w: 'full', bg: 'primary', _hover: { bg: 'primary/90' }, color: 'white', fontWeight: 'medium', py: '3', px: '4', rounded: 'lg', transition: 'colors', display: 'flex', alignItems: 'center', justifyContent: 'center', _disabled: { opacity: '0.5', cursor: 'not-allowed' } })"
          >
            <svg xmlns="http://www.w3.org/2000/svg" :class="css({ h: '5', w: '5', mr: '2' })" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
import { css } from "styled-system/css";
import { ref, onMounted } from "vue";
import { actions } from "astro:actions";
import {
	getSessionCampaignAttribution,
	serializeCampaignAttribution,
} from "@/lib/analytics/attribution";
import H2Highlight from "@/components/title/h2-highlight.vue";

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
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");
const isAlreadySubscribed = ref(props.isAlreadySubscribed ?? false);
const checkingSubscription = ref(false);

const disclaimer = props.sponsor
	? "By signing up, you agree to receive course updates and notifications."
	: null;

// Optionally check subscription status on mount if deferred
onMounted(async () => {
	if (props.deferSubscriptionCheck && props.isAlreadySubscribed === undefined) {
		checkingSubscription.value = true;
		try {
			const response = await fetch(
				`/api/subscriptions/check?audienceId=${encodeURIComponent(props.audienceId)}`,
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