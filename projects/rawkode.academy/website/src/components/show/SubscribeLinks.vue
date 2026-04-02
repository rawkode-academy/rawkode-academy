<template>
	<div v-if="links.length > 0" :class="wrapperStyles">
		<p :class="labelStyles">
			Subscribe
		</p>
		<div :class="linksContainerStyles">
			<a
				v-for="link in links"
				:key="link.url"
				:href="link.url"
				target="_blank"
				rel="noopener noreferrer"
				:class="linkStyles"
				@click="handleSubscribeClick(link)"
			>
				<font-awesome-icon :icon="getIcon(link.icon)" :class="iconStyles" />
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
import { css } from "../../../styled-system/css";

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

const wrapperStyles = css({
	display: "flex",
	flexDirection: "column",
	gap: "3",
});

const labelStyles = css({
	fontSize: "sm",
	fontWeight: "semibold",
	textTransform: "uppercase",
	letterSpacing: "wide",
	color: "fg.muted",
});

const linksContainerStyles = css({
	display: "flex",
	flexWrap: "wrap",
	gap: "2",
});

const linkStyles = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "2",
	borderRadius: "lg",
	px: "4",
	py: "2",
	fontSize: "sm",
	fontWeight: "medium",
	color: "fg.default",
	bg: "bg.subtle",
	border: "1px solid",
	borderColor: "border.subtle",
	transition: "all",
	transitionDuration: "200ms",
	_hover: {
		shadow: "md",
		transform: "scale(1.02)",
	},
	_focusVisible: {
		outline: "none",
		ring: "2px",
		ringColor: "colorPalette.default",
		ringOffset: "2px",
	},
});

const iconStyles = css({
	h: "4",
	w: "4",
});
</script>
