<template>
  <div class="share-button-container">
    <button @click="copyLink" class="share-button copy-link-button">
      <font-awesome-icon icon="copy" class="icon" />
      {{ copyButtonText }}
    </button>
    <a :href="blueskyShareUrl" target="_blank" rel="noopener noreferrer" class="share-button social-button bluesky-button" @click="() => trackShare('bluesky')">
      <font-awesome-icon :icon="['fab', 'bluesky']" class="icon" />
      Share on BlueSky
    </a>
    <a :href="linkedinShareUrl" target="_blank" rel="noopener noreferrer" class="share-button social-button linkedin-button" @click="() => trackShare('linkedin')">
      <font-awesome-icon :icon="['fab', 'linkedin']" class="icon" />
      Share on LinkedIn
    </a>
    <a :href="redditShareUrl" target="_blank" rel="noopener noreferrer" class="share-button social-button reddit-button" @click="() => trackShare('reddit')">
      <font-awesome-icon :icon="['fab', 'reddit']" class="icon" />
      Share on Reddit
    </a>
  </div>
</template>

<script setup lang="ts">
import { actions } from "astro:actions";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
	faBluesky,
	faLinkedin,
	faReddit,
} from "@fortawesome/free-brands-svg-icons";
import { faCopy, faShare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref } from "vue";

library.add(faCopy, faShare, faLinkedin, faReddit, faBluesky);

const props = defineProps<{
	videoId: string;
	videoTitle: string;
	videoSlug: string;
}>();

const copyButtonText = ref("Copy Link");

const shareUrl = computed(
	() => `https://rawkode.academy/watch/${props.videoSlug}`,
);

const linkedinShareUrl = computed(() => {
	const url = encodeURIComponent(shareUrl.value);
	return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
});

async function trackShare(
	platform: "clipboard" | "bluesky" | "linkedin" | "reddit",
	action: "share" = "share",
) {
	try {
		await actions.trackShareEvent({
			action,
			platform,
			content_type: "video",
			content_id: props.videoId,
			success: true,
		});
	} catch (error) {
		console.error(`Failed to track ${platform} share:`, error);
	}
}

const copyLink = async () => {
	try {
		await navigator.clipboard.writeText(shareUrl.value);
		copyButtonText.value = "Link Copied!";
		await trackShare("clipboard", "share");
		setTimeout(() => {
			copyButtonText.value = "Copy Link";
		}, 2000);
	} catch (err) {
		console.error("Failed to copy: ", err);
		copyButtonText.value = "Failed to copy";
		setTimeout(() => {
			copyButtonText.value = "Copy Link";
		}, 2000);
	}
};

const blueskyShareUrl = computed(() => {
	const url = encodeURIComponent(shareUrl.value);
	const text = encodeURIComponent(props.videoTitle);
	return `https://bsky.app/intent/compose?text=${text}%20${url}`;
});

const redditShareUrl = computed(() => {
	const url = encodeURIComponent(shareUrl.value);
	const text = encodeURIComponent(props.videoTitle);
	return `https://www.reddit.com/submit?url=${url}&title=${text}`;
});
</script>

<style scoped>
.share-button-container {
  display: flex;
  gap: 0.75rem; /* 12px */
  align-items: center;
  margin: 1rem 0; /* 16px */
}

.share-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem; /* 8px 16px */
  border-radius: 0.375rem; /* 6px */
  font-weight: 500;
  font-size: 0.875rem; /* 14px */
  line-height: 1.25rem; /* 20px */
  cursor: pointer;
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  border: 1px solid transparent;
  gap: 0.5rem; /* 8px */
}

.share-button .icon {
  width: 1.25rem; /* 20px */
  height: 1.25rem; /* 20px */
  margin-right: 0.5rem; /* 8px */
}

.copy-link-button {
  background-color: #4a5568; /* gray-700 */
  color: #ffffff;
  border-color: #2d3748; /* gray-800 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-link-button:hover {
  background-color: #2d3748; /* gray-800 */
  border-color: #2d3748; /* gray-800 */
}

.social-button {
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.x-button {
  background-color: #000000; /* Black */
  border-color: #000000; /* Black */
  display: flex;
  align-items: center;
  justify-content: center;
}
.x-button:hover {
  background-color: #1a1a1a; /* Slightly lighter black on hover */
  border-color: #1a1a1a;
  color: #ffffff;
}

.linkedin-button {
  background-color: #0A66C2;
  border-color: #004182;
  display: flex;
  align-items: center;
  justify-content: center;
}
.linkedin-button:hover {
  background-color: #004182;
  border-color: #004182;
  color: #ffffff;
}

.bluesky-button {
  background-color: #0077FF; /* Example BlueSky color */
  border-color: #005fcc; /* Darker shade */
  display: flex;
  align-items: center;
  justify-content: center;
}
.bluesky-button:hover {
  background-color: #005fcc;
  border-color: #005fcc;
  color: #ffffff;
}

.reddit-button {
  background-color: #FF4500; /* Reddit orange */
  border-color: #cc3700; /* Darker shade */
  display: flex;
  align-items: center;
  justify-content: center;
}
.reddit-button:hover {
  background-color: #cc3700;
  border-color: #cc3700;
  color: #ffffff;
}
</style>
