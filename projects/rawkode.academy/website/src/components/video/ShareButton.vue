<template>
  <div class="flex flex-wrap gap-2 sm:gap-3 items-center my-4">
    <button @click="copyLink" class="glass-interactive inline-flex items-center justify-center px-3 sm:px-4 py-2 text-sm font-medium gap-2 text-secondary-content">
      <font-awesome-icon icon="copy" class="w-4 h-4" />
      <span class="hidden sm:inline">{{ copyButtonText }}</span>
      <span class="sm:hidden">Copy</span>
    </button>
    <a :href="blueskyShareUrl" target="_blank" rel="noopener noreferrer" class="btn-social bg-[#0077FF] hover:bg-[#005fcc]" @click="() => trackShare('bluesky')">
      <font-awesome-icon :icon="['fab', 'bluesky']" class="w-4 h-4" />
      <span class="hidden sm:inline">BlueSky</span>
    </a>
    <a :href="linkedinShareUrl" target="_blank" rel="noopener noreferrer" class="btn-social bg-[#0A66C2] hover:bg-[#004182]" @click="() => trackShare('linkedin')">
      <font-awesome-icon :icon="['fab', 'linkedin']" class="w-4 h-4" />
      <span class="hidden sm:inline">LinkedIn</span>
    </a>
    <a :href="redditShareUrl" target="_blank" rel="noopener noreferrer" class="btn-social bg-[#FF4500] hover:bg-[#cc3700]" @click="() => trackShare('reddit')">
      <font-awesome-icon :icon="['fab', 'reddit']" class="w-4 h-4" />
      <span class="hidden sm:inline">Reddit</span>
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

