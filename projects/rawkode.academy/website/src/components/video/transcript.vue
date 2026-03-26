<template>
  <div class="transcript-wrapper">
    <!-- Search bar -->
    <div v-if="transcriptLoaded && !error" class="mb-4">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search transcript..."
          aria-label="Search transcript"
          class="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <svg
          class="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
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
      <div v-if="searchQuery.length >= 2" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        <span>{{ searchResultsText }}</span>
      </div>
    </div>

    <!-- Loading state -->
    <SkeletonTranscript v-if="loading" />

    <!-- Error state -->
    <div v-if="error" class="text-center py-8">
      <p class="text-red-600 dark:text-red-400">{{ errorMessage }}</p>
    </div>

    <!-- Transcript content with scrollable container -->
    <div v-if="transcriptLoaded && !error" class="transcript-container" aria-live="polite">
      <div
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        class="transcript-paragraph mb-6"
      >
        <div class="text-sm text-primary dark:text-primary font-mono mb-2">
          {{ paragraph[0].start }}
        </div>
        <div class="text-gray-900 dark:text-gray-100 leading-relaxed">
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
import SkeletonTranscript from "@/components/common/SkeletonTranscript.vue";
import {
	groupTranscriptParagraphs,
	parseWebVTT,
} from "@/utils/video-transcript";

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
		initialCues: {
			type: Array,
			default: () => [],
		},
		initialParagraphs: {
			type: Array,
			default: () => [],
		},
	},
	data() {
		const initialCues = Array.isArray(this.initialCues)
			? [...this.initialCues]
			: [];
		const initialParagraphs = Array.isArray(this.initialParagraphs)
			? this.initialParagraphs
			: [];

		return {
			loading: false,
			error: false,
			errorMessage: "Failed to load transcript. Please try again later.",
			transcriptLoaded: initialParagraphs.length > 0 || initialCues.length > 0,
			cues: initialCues,
			paragraphs: initialParagraphs.length
				? initialParagraphs
				: groupTranscriptParagraphs(initialCues),
			searchQuery: "",
			matchCount: 0,
		};
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
