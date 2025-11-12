<template>
  <div class="comments-section mt-8">
    <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
      Comments {{ !loading ? `(${comments.length})` : '' }}
    </h3>

    <div v-if="loading" class="space-y-2">
      <SkeletonComment v-for="i in 3" :key="i" :lines="2" />
    </div>

    <ErrorState 
      v-else-if="error"
      :message="error"
      :on-retry="fetchComments"
      retry-text="Retry loading comments"
    />

    <div v-else-if="comments.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>No comments yet. Be the first to comment on Zulip!</p>
      <a
        v-if="zulipTopicUrl"
        :href="zulipTopicUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center mt-2 text-primary hover:text-primary/90 dark:text-primary dark:hover:text-primary/90"
      >
        Join the discussion on Zulip
        <svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <img
              v-if="comment.avatar_url"
              :src="comment.avatar_url"
              :alt="comment.author"
              class="h-8 w-8 rounded-full"
              loading="lazy"
            />
            <div
              v-else
              class="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium"
            >
              {{ comment.author.charAt(0).toUpperCase() }}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ comment.author }}
              </h4>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(comment.timestamp) }}
              </span>
            </div>

            <div
              class="text-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none dark:prose-invert"
              v-html="formatContent(comment.content)"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="zulipTopicUrl" class="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          :href="zulipTopicUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center text-primary hover:text-primary/90 dark:text-primary dark:hover:text-primary/90"
        >
          Want to share your thoughts? Join the discussion on Zulip
          <svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
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
const zulipTopicUrl = ref<string | null>(null);

const fetchComments = async () => {
	try {
		loading.value = true;
		error.value = null;

		const response = await fetch(`/api/comments/${props.videoId}`);
		const data = await handleApiResponse<{
			comments?: Comment[];
			zulipTopicUrl?: string;
			error?: string;
		}>(response);

		if (data.error) {
			throw new Error(data.error);
		}

		comments.value = data.comments || [];
		zulipTopicUrl.value = data.zulipTopicUrl || null;
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
	// Basic Zulip markdown to HTML conversion
	// This is a simplified version - you might want to use a proper markdown parser
	return content
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.*?)\*/g, "<em>$1</em>")
		.replace(
			/`(.*?)`/g,
			'<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">$1</code>',
		)
		.replace(/\n/g, "<br>");
};

onMounted(() => {
	fetchComments();
});
</script>

<style scoped>
@reference "@/styles/global.css";
.comments-section {
  max-width: 100%;
}

.prose code {
  @apply bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm;
}
</style>
