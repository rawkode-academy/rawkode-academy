<template>
 <div :class="watch.comments">
 <h3 :class="watch.commentsTitle">
 Comments {{ !loading ? `(${comments.length})` : '' }}
 </h3>

 <div v-if="loading" :class="watch.commentList">
 <SkeletonComment v-for="i in 3" :key="i" :lines="2" />
 </div>

 <ErrorState 
 v-else-if="error"
 :message="error"
 :on-retry="fetchComments"
 retry-text="Retry loading comments"
 />

 <EmptyState
 v-else-if="comments.length === 0"
 title="No comments yet."
 body="Be the first to start the discussion."
 >
 <template v-if="discordInviteUrl" #actions>
 <a
 :href="discordInviteUrl"
 target="_blank"
 rel="noopener noreferrer"
 >
 Join the discussion on Discord →
 </a>
 </template>
 </EmptyState>

 <div v-else :class="watch.commentList">
 <div
 v-for="comment in comments"
 :key="comment.id"
 :class="watch.comment"
 >
 <div :class="watch.commentRow">
 <div>
 <img
 v-if="comment.avatar_url"
 :src="comment.avatar_url"
 :alt="comment.author"
 :class="watch.commentAvatar"
 loading="lazy"
 />
 <div
 v-else
 :class="watch.commentAvatarFallback"
 >
 {{ comment.author.charAt(0).toUpperCase() }}
 </div>
 </div>

 <div :class="watch.commentContent">
 <div :class="watch.commentMeta">
 <h4 :class="watch.commentAuthor">
 {{ comment.author }}
 </h4>
 <span :class="watch.commentDate">
 {{ formatDate(comment.timestamp) }}
 </span>
 </div>

 <div
 :class="watch.commentBody"
 v-html="formatContent(comment.content)"
 ></div>
 </div>
 </div>
 </div>

 <div v-if="discordInviteUrl">
 <a
 :href="discordInviteUrl"
 target="_blank"
 rel="noopener noreferrer"
 :class="watch.commentCta"
 >
 Want to share your thoughts? Join the discussion on Discord
 <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
 </svg>
 </a>
 </div>
 </div>
 </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { academyWatch } from "@rawkodeacademy/design-system";
import SkeletonComment from "@/components/common/SkeletonComment.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
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
const watch = academyWatch();

const comments = ref<Comment[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const discordInviteUrl = ref<string | null>(null);

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
	// Basic markdown to HTML conversion (keep lightweight for client)
	// This is a simplified version - use a proper markdown parser if content expands
	return content
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.*?)\*/g, "<em>$1</em>")
		.replace(/`(.*?)`/g, "<code>$1</code>")
		.replace(/\n/g, "<br>");
};

onMounted(() => {
	fetchComments();
});
</script>
