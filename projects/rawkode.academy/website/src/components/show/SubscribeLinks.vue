<template>
	<div v-if="links.length > 0" class="flex flex-col gap-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
			Subscribe
		</p>
		<div class="flex flex-wrap gap-2">
			<a
				v-for="link in links"
				:key="link.url"
				:href="link.url"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-700"
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

interface SubscribeLink {
	platform: string;
	url: string;
	icon: string;
}

defineProps<{
	links: SubscribeLink[];
}>();

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
