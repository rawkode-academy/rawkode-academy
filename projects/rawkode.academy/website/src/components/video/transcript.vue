<template>
  <div class="transcript-wrapper">
    <!-- Search bar -->
    <div v-if="transcriptLoaded && !error" :class="searchWrapperClass">
      <div :class="searchContainerClass">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search transcript..."
          aria-label="Search transcript"
          :class="searchInputClass"
        />
        <svg
          :class="searchIconClass"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
      </div>
      <div v-if="searchQuery.length >= 2" :class="searchResultsClass">
        <span>{{ searchResultsText }}</span>
      </div>
    </div>

    <!-- Loading state -->
    <SkeletonTranscript v-if="loading" />

    <!-- Error state -->
    <div v-if="error" :class="errorClass">
      <p :class="errorTextClass">{{ errorMessage }}</p>
    </div>

    <!-- Transcript content with scrollable container -->
    <div v-if="transcriptLoaded && !error" class="transcript-container" aria-live="polite">
      <div
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        :class="paragraphClass"
      >
        <div :class="timestampClass">
          {{ paragraph[0].start }}
        </div>
        <div :class="textClass">
          <span
            v-for="(cue, cueIndex) in paragraph"
            :key="`${index}-${cueIndex}`"
            :data-start="cue.start"
            class="transcript-segment"
            v-html="highlightText(cue.text)"
          ></span>
          {{ ' ' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { css } from "../../../styled-system/css";
import SkeletonTranscript from "@/components/common/SkeletonTranscript.vue";
import {
	groupTranscriptParagraphs,
	parseWebVTT,
} from "@/utils/video-transcript";

const styles = {
	searchWrapperClass: css({ mb: "4" }),
	searchContainerClass: css({ position: "relative" }),
	searchInputClass: css({
		w: "full",
		px: "4",
		py: "2",
		pl: "10",
		borderWidth: "1px",
		borderColor: { base: "gray.300", _dark: "gray.700" },
		borderRadius: "lg",
		bg: { base: "white", _dark: "gray.800" },
		color: { base: "gray.900", _dark: "gray.100" },
		_focus: { ring: "2", ringColor: "rgb(var(--brand-primary))", borderColor: "transparent" },
	}),
	searchIconClass: css({
		position: "absolute",
		left: "3",
		top: "2.5",
		w: "5",
		h: "5",
		color: "gray.400",
	}),
	searchResultsClass: css({
		mt: "2",
		fontSize: "sm",
		color: { base: "gray.600", _dark: "gray.400" },
	}),
	errorClass: css({ textAlign: "center", py: "8" }),
	errorTextClass: css({ color: { base: "red.600", _dark: "red.400" } }),
	paragraphClass: css({ mb: "6" }),
	timestampClass: css({
		fontSize: "sm",
		color: "rgb(var(--brand-primary))",
		fontFamily: "mono",
		mb: "2",
	}),
	textClass: css({
		color: { base: "gray.900", _dark: "gray.100" },
		lineHeight: "relaxed",
	}),
};

export default {
	components: {
		SkeletonTranscript,
	},
	props: {
		videoId: {
			type: String,
			required: true,
		},
		isActive: {
			type: Boolean,
			default: false,
		},
	},
	data() {
		return {
			loading: false,
			error: false,
			errorMessage: "Failed to load transcript. Please try again later.",
			transcriptLoaded: false,
			cues: [],
			paragraphs: [],
			searchQuery: "",
			matchCount: 0,
		};
	},
	created() {
		// Expose static CSS class names as non-reactive properties
		Object.assign(this, styles);
	},
	computed: {
		searchResultsText() {
			if (this.searchQuery.length < 2) return "";
			return this.matchCount > 0
				? `${this.matchCount} match${this.matchCount !== 1 ? "es" : ""} found`
				: "No matches found";
		},
	},
	methods: {
		async loadTranscript() {
			if (this.transcriptLoaded) return;

			this.loading = true;
			this.error = false;

			try {
				const transcriptUrl = `https://content.rawkode.academy/videos/${this.videoId}/captions/en.vtt`;
				const response = await fetch(transcriptUrl);

				if (!response.ok) {
					throw new Error(
						`Failed to fetch transcript: ${response.status} ${response.statusText}`,
					);
				}

				const vttText = await response.text();
				this.cues = parseWebVTT(vttText);

				if (this.cues.length === 0) {
					throw new Error("No transcript content found");
				}

				// Group cues into paragraphs
				this.paragraphs = groupTranscriptParagraphs(this.cues);
				this.transcriptLoaded = true;
			} catch (error) {
				console.error("Failed to load transcript:", error);
				this.error = true;
				if (error instanceof Error) {
					this.errorMessage = `Failed to load transcript: ${error.message}`;
				}
			} finally {
				this.loading = false;
			}
		},

		highlightText(text) {
			if (!this.searchQuery || this.searchQuery.length < 2) {
				return this.escapeHtml(text);
			}

			const query = this.searchQuery.toLowerCase();
			const lowerText = text.toLowerCase();

			if (!lowerText.includes(query)) {
				return this.escapeHtml(text);
			}

			// Escape HTML first, then apply highlighting
			const escapedText = this.escapeHtml(text);
			const regex = new RegExp(
				`(${this.escapeRegExp(this.searchQuery)})`,
				"gi",
			);
			return escapedText.replace(
				regex,
				'<span class="transcript-highlight">$1</span>',
			);
		},

		escapeHtml(text) {
			return String(text)
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;")
				.replaceAll("'", "&#39;");
		},

		escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		},

		performSearch(query) {
			if (!query || query.length < 2) {
				this.matchCount = 0;
				return;
			}

			this.matchCount = 0;
			const lowerQuery = query.toLowerCase();
			let firstMatch = null;

			// Count matches
			this.cues.forEach((cue) => {
				if (cue.text.toLowerCase().includes(lowerQuery)) {
					this.matchCount++;
					if (!firstMatch) {
						firstMatch = cue;
					}
				}
			});

			// Scroll to first match
			if (firstMatch && this.$el) {
				this.$nextTick(() => {
					const element = this.$el.querySelector(
						`[data-start="${firstMatch.start}"]`,
					);
					if (element) {
						element.scrollIntoView({ behavior: "smooth", block: "center" });
					}
				});
			}
		},
	},
	watch: {
		isActive: {
			handler(newVal) {
				if (newVal && !this.transcriptLoaded && !this.loading) {
					this.loadTranscript();
				}
			},
			immediate: true,
		},
	},
};
</script>

<style scoped>
/* Transcript container styles */
.transcript-container {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Custom scrollbar for transcript */
.transcript-container::-webkit-scrollbar {
  width: 8px;
}

.transcript-container::-webkit-scrollbar-track {
  background: rgb(229 231 235);
  border-radius: 4px;
}

.dark .transcript-container::-webkit-scrollbar-track {
  background: rgb(55 65 81);
}

.transcript-container::-webkit-scrollbar-thumb {
  background: rgb(156 163 175);
  border-radius: 4px;
}

.transcript-container::-webkit-scrollbar-thumb:hover {
  background: rgb(107 114 128);
}

.dark .transcript-container::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

.dark .transcript-container::-webkit-scrollbar-thumb:hover {
  background: rgb(107 114 128);
}

/* Highlight for search results */
:deep(.transcript-highlight) {
  background-color: rgb(254 240 138);
  color: rgb(0 0 0);
  padding: 0 2px;
  border-radius: 2px;
}

.dark :deep(.transcript-highlight) {
  background-color: rgb(251 191 36);
  color: rgb(0 0 0);
}
</style>
