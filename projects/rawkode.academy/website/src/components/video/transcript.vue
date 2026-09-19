<template>
 <div :class="styles.comments">
 <!-- Search bar -->
 <div v-if="transcriptLoaded && !error">
 <div :class="styles.search">
 <input
 v-model="searchQuery"
 type="text"
 placeholder="Search transcript..."
 aria-label="Search transcript"
 :class="styles.searchInput"
 />
 <svg
 :class="styles.searchIcon"
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
 <div v-if="searchQuery.length >= 2" :class="styles.searchSummary">
 <span>{{ searchResultsText }}</span>
 </div>
 </div>

 <!-- Loading state -->
 <SkeletonTranscript v-if="loading" />

 <!-- Error state -->
 <div v-if="error">
 <p :class="styles.noticeCopy">{{ errorMessage }}</p>
 </div>

 <!-- Transcript content with scrollable container -->
 <div v-if="transcriptLoaded && !error" :class="styles.transcriptContainer" aria-live="polite">
 <div
 v-for="(paragraph, index) in paragraphs"
 :key="index"
 :class="styles.transcriptRow"
 >
 <div :class="styles.transcriptTimestamp">
 {{ paragraph[0].start }}
 </div>
 <div :class="styles.transcriptText">
 <span
 v-for="(cue, cueIndex) in paragraph"
 :key="`${index}-${cueIndex}`"
 :data-start="cue.start"
 :class="styles.transcriptSegment"
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
import { academyWatch } from "@rawkodeacademy/design-system";
import {
	groupTranscriptParagraphs,
	parseWebVTT,
} from "@/utils/video-transcript";

const watchStyles = academyWatch();

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
			styles: watchStyles,
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
				`<span class="${watchStyles.transcriptHighlight}">$1</span>`,
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
