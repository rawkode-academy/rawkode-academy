<template>
	<div v-if="links.length > 0" class="flex flex-col gap-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-muted">
			Subscribe
		</p>
		<div class="flex flex-wrap gap-2">
			<a
				v-for="link in links"
				:key="link.url"
				:href="link.url"
				target="_blank"
				rel="noopener noreferrer"
				class="glass-chip gap-2 rounded-lg px-4 py-2 text-sm font-medium text-secondary-content transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
				@click="handleSubscribeClick(link)"
			>
				<font-awesome-icon :icon="getIcon(link.icon)" class="h-4 w-4" />
				{{ link.platform }}
			</a>
		</div>
	</div>
</template>

<script setup lang="ts">
import { library } from "@fortawesome/fontawesome-svg-core";
import {
	faSpotify,
	faYoutube,
	faApple,
	faAmazon,
} from "@fortawesome/free-brands-svg-icons";
import { faPodcast, faRss, faLink } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

library.add(faSpotify, faYoutube, faApple, faAmazon, faPodcast, faRss, faLink);

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface SubscribeLink {
	platform: string;
	url: string;
	icon: string;
}

defineProps<{
	links: SubscribeLink[];
}>();

const handleSubscribeClick = (link: SubscribeLink) => {
	trackEvent("podcast_subscribe_clicked", {
		platform: link.platform,
		icon_type: link.icon,
		destination_url: link.url,
	});
};

function getIcon(iconType: string): string | [string, string] {
	switch (iconType) {
		case "spotify":
			return ["fab", "spotify"];
		case "youtube":
			return ["fab", "youtube"];
		case "apple-podcasts":
			return ["fab", "apple"];
		case "amazon-music":
			return ["fab", "amazon"];
		case "pocket-casts":
			return "podcast";
		case "overcast":
			return "podcast";
		case "rss":
			return "rss";
		default:
			return "link";
	}
}
</script>
