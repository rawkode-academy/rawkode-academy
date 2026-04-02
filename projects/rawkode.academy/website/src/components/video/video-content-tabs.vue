<template>
	<div :class="wrapperStyles">
		<!-- Mobile dropdown (sm:hidden) -->
		<div :class="mobileDropdownContainer">
			<label for="tabs-mobile" class="sr-only">Select a tab</label>
			<select
				id="tabs-mobile"
				name="tabs-mobile"
				:class="mobileSelectStyles"
				:value="activeTab"
				@change="setActiveTab(($event.target as HTMLSelectElement).value)"
			>
				<option v-for="tab in tabs" :key="tab.id" :value="tab.id">
					{{ tab.label }}
				</option>
			</select>
		</div>

		<!-- Ark UI Tabs for sm and up -->
		<TabsRoot
			:class="tabsRootStyles"
			:model-value="activeTab"
			@value-change="handleTabChange"
		>
			<TabList :class="tabListStyles">
				<TabTrigger
					v-for="tab in tabs"
					:key="tab.id"
					:value="tab.id"
					:class="tabTriggerStyles"
				>
					{{ tab.label }}
				</TabTrigger>
				<TabIndicator :class="tabIndicatorStyles" />
			</TabList>

			<TabContent value="comments" :class="tabContentStyles">
				<VideoComments :video-id="videoId" />
			</TabContent>

			<TabContent value="transcript" :class="tabContentStyles">
				<VideoTranscript
					:video-id="videoId"
					:is-active="activeTab === 'transcript'"
				/>
			</TabContent>

			<TabContent value="resources" :class="tabContentStyles">
				<div :class="proseStyles">
					<p>
						Resources related to this video will be displayed here, including
						links, downloads, and additional materials.
					</p>
				</div>
			</TabContent>
		</TabsRoot>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { TabsRoot, TabList, TabTrigger, TabContent, TabIndicator } from "@ark-ui/vue/tabs";
import VideoComments from "./comments.vue";
import VideoTranscript from "./transcript.vue";
import { css } from "../../../styled-system/css";

const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

const props = defineProps<{
	videoId: string;
}>();

// activeTab: "comments" is the default selected tab
const activeTab = ref("comments");

const tabs = [
	{ id: "comments", label: "Comments" },
	{ id: "transcript", label: "Transcript" },
	{ id: "resources", label: "Resources" },
];

const setActiveTab = (tabId: string) => {
	const previousTab = activeTab.value;
	activeTab.value = tabId;
	trackEvent("video_tab_viewed", {
		tab_id: tabId,
		previous_tab: previousTab,
		video_id: props.videoId,
	});
};

const handleTabChange = (details: { value: string }) => {
	setActiveTab(details.value);
};

const wrapperStyles = css({
	position: "relative",
});

const mobileDropdownContainer = css({
	display: "block",
	px: "2",
	pt: "2",
	pb: "3",
	sm: { display: "none" },
});

const mobileSelectStyles = css({
	display: "block",
	w: "full",
	pl: "3",
	pr: "10",
	py: "2",
	fontSize: "base",
	color: { base: "gray.900", _dark: "white" },
	bg: { base: "rgba(255,255,255,0.4)", _dark: "rgba(31,41,55,0.6)" },
	backdropFilter: "blur(8px)",
	borderWidth: "1px",
	borderColor: "border.subtle",
	rounded: "lg",
	_focus: {
		outline: "2px solid",
		outlineColor: "primary",
		outlineOffset: "2px",
	},
});

const tabsRootStyles = css({
	display: "none",
	sm: { display: "block" },
});

const tabListStyles = css({
	display: "flex",
	borderBottomWidth: "1px",
	borderColor: "border.subtle",
	position: "relative",
	overflowX: "auto",
	/* Hide scrollbar */
	scrollbarWidth: "none",
	"&::-webkit-scrollbar": { display: "none" },
});

const tabTriggerStyles = css({
	flexShrink: "0",
	px: "6",
	py: "3",
	borderBottomWidth: "2px",
	borderColor: "transparent",
	fontWeight: "medium",
	fontSize: "sm",
	whiteSpace: "nowrap",
	transition: "colors",
	transitionDuration: "200ms",
	cursor: "pointer",
	color: { base: "gray.500", _dark: "gray.400" },
	_hover: {
		color: { base: "gray.900", _dark: "white" },
	},
	_selected: {
		borderColor: "primary",
		color: "primary",
	},
});

const tabIndicatorStyles = css({
	h: "0.5",
	bg: "primary",
	rounded: "full",
});

const tabContentStyles = css({
	p: "4",
	sm: { p: "6" },
	position: "relative",
	zIndex: "10",
});

const proseStyles = css({
	color: { base: "gray.500", _dark: "gray.400" },
	maxW: "none",
	fontSize: "lg",
});
</script>
