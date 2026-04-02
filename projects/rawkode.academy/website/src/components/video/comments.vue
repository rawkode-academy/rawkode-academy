<template>
  <div :class="sectionClass">
    <h3 :class="headingClass">
      Comments {{ !loading ? `(${comments.length})` : '' }}
    </h3>

    <div v-if="loading" :class="loadingContainerClass">
      <SkeletonComment v-for="i in 3" :key="i" :lines="2" />
    </div>

    <ErrorState
      v-else-if="error"
      :message="error"
      :on-retry="fetchComments"
      retry-text="Retry loading comments"
    />

    <div v-else-if="comments.length === 0" :class="emptyStateClass">
      <p>No comments yet. Join the discussion on Discord!</p>
      <a
        v-if="discordInviteUrl"
        :href="discordInviteUrl"
        target="_blank"
        rel="noopener noreferrer"
        :class="discordLinkClass"
      >
        Join the discussion on Discord
        <svg :class="linkIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    </div>

    <div v-else :class="commentsListClass">
      <div
        v-for="comment in comments"
        :key="comment.id"
        :class="commentCardClass"
      >
        <div :class="commentInnerClass">
          <div :class="avatarWrapClass">
            <img
              v-if="comment.avatar_url"
              :src="comment.avatar_url"
              :alt="comment.author"
              :class="avatarImgClass"
              loading="lazy"
            />
            <div
              v-else
              :class="avatarFallbackClass"
            >
              {{ comment.author.charAt(0).toUpperCase() }}
            </div>
          </div>

          <div :class="commentBodyClass">
            <div :class="commentMetaClass">
              <h4 :class="authorClass">
                {{ comment.author }}
              </h4>
              <span :class="dateClass">
                {{ formatDate(comment.timestamp) }}
              </span>
            </div>

            <div
              :class="contentClass"
              v-html="formatContent(comment.content)"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="discordInviteUrl" :class="footerClass">
        <a
          :href="discordInviteUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="discordLinkClass"
        >
          Want to share your thoughts? Join the discussion on Discord
          <svg :class="linkIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { css } from "../../../styled-system/css";
import SkeletonComment from "@/components/common/SkeletonComment.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import { handleApiResponse, getErrorMessage } from "@/utils/error-handler";

interface Comment {
	id: number;
	author: string;
	email: string;
	content: string;
	timestamp: string;
	avatar_url?: string;
}

interface Props {
	videoId: string;
}

const props = defineProps<Props>();

const comments = ref<Comment[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const discordInviteUrl = ref<string | null>(null);

// PandaCSS class definitions
const sectionClass = css({ mt: "8", maxWidth: "full" });

const headingClass = css({
	fontSize: "xl",
	fontWeight: "semibold",
	mb: "4",
	color: { base: "gray.900", _dark: "white" },
});

const loadingContainerClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "2",
});

const emptyStateClass = css({
	textAlign: "center",
	py: "8",
	color: { base: "gray.500", _dark: "gray.400" },
});

const discordLinkClass = css({
	display: "inline-flex",
	alignItems: "center",
	mt: "2",
	color: "rgb(var(--brand-primary))",
	_hover: { opacity: 0.9 },
});

const linkIconClass = css({ ml: "1", w: "4", h: "4" });

const commentsListClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "4",
});

const commentCardClass = css({
	bg: { base: "white", _dark: "gray.800" },
	borderWidth: "1px",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	borderRadius: "lg",
	p: "4",
});

const commentInnerClass = css({
	display: "flex",
	alignItems: "flex-start",
	gap: "3",
});

const avatarWrapClass = css({ flexShrink: 0 });

const avatarImgClass = css({
	h: "8",
	w: "8",
	borderRadius: "full",
});

const avatarFallbackClass = css({
	h: "8",
	w: "8",
	borderRadius: "full",
	bg: "rgb(var(--brand-primary))",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: "white",
	fontSize: "sm",
	fontWeight: "medium",
});

const commentBodyClass = css({ flex: 1, minWidth: 0 });

const commentMetaClass = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
	mb: "1",
});

const authorClass = css({
	fontSize: "sm",
	fontWeight: "medium",
	color: { base: "gray.900", _dark: "white" },
});

const dateClass = css({
	fontSize: "xs",
	color: { base: "gray.500", _dark: "gray.400" },
});

const contentClass = css({
	fontSize: "sm",
	color: { base: "gray.700", _dark: "gray.300" },
	maxWidth: "none",
});

const footerClass = css({
	textAlign: "center",
	pt: "4",
	borderTopWidth: "1px",
	borderColor: { base: "gray.200", _dark: "gray.700" },
});

const fetchComments = async () => {
	try {
		loading.value = true;
		error.value = null;

		const response = await fetch(`/api/comments/${props.videoId}`);
		const data = await handleApiResponse<{
			comments?: Comment[];
			discordInviteUrl?: string;
			error?: string;
		}>(response);

		if (data.error) {
			throw new Error(data.error);
		}

		comments.value = data.comments || [];
		discordInviteUrl.value = data.discordInviteUrl || null;
	} catch (err) {
		error.value = getErrorMessage(err);
	} finally {
		loading.value = false;
	}
};

const formatDate = (timestamp: string): string => {
	const date = new Date(timestamp);
	const now = new Date();
	const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

	if (diffInHours < 1) {
		const diffInMinutes = Math.floor(diffInHours * 60);
		return diffInMinutes <= 1 ? "just now" : `${diffInMinutes} minutes ago`;
	}
	if (diffInHours < 24) {
		const hours = Math.floor(diffInHours);
		return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	}
	if (diffInHours < 24 * 7) {
		const days = Math.floor(diffInHours / 24);
		return `${days} day${days === 1 ? "" : "s"} ago`;
	}
	return date.toLocaleDateString();
};

const formatContent = (content: string): string => {
	return content
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.*?)\*/g, "<em>$1</em>")
		.replace(
			/`(.*?)`/g,
			'<code style="background: var(--surface-card-muted); padding: 0 0.25rem; border-radius: 0.25rem;">$1</code>',
		)
		.replace(/\n/g, "<br>");
};

onMounted(() => {
	fetchComments();
});
</script>

