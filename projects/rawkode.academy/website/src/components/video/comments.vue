<template>
  <div class="comments-section" :class="css({ mt: '8' })">
    <h3 :class="css({ fontSize: 'xl', fontWeight: 'semibold', mb: '4', color: 'gray.900', _dark: { color: 'white' } })">
      Comments {{ !loading ? `(${comments.length})` : '' }}
    </h3>

    <div v-if="loading" :class="css({ '& > * + *': { mt: '2' } })">
      <SkeletonComment v-for="i in 3" :key="i" :lines="2" />
    </div>

    <ErrorState
      v-else-if="error"
      :message="error"
      :on-retry="fetchComments"
      retry-text="Retry loading comments"
    />

    <div v-else-if="comments.length === 0" :class="css({ textAlign: 'center', py: '8', color: 'gray.500', _dark: { color: 'gray.400' } })">
      <p>No comments yet. Join the discussion on Discord!</p>
      <a
        v-if="discordInviteUrl"
        :href="discordInviteUrl"
        target="_blank"
        rel="noopener noreferrer"
        :class="css({ display: 'inline-flex', alignItems: 'center', mt: '2', color: 'primary', _hover: { color: 'primary/90' }, _dark: { color: 'primary', _hover: { color: 'primary/90' } } })"
      >
        Join the discussion on Discord
        <svg :class="css({ ml: '1', w: '4', h: '4' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    </div>

    <div v-else :class="css({ '& > * + *': { mt: '4' } })">
      <div
        v-for="comment in comments"
        :key="comment.id"
        :class="css({ bg: 'white', _dark: { bg: 'gray.800' }, borderWidth: '1px', borderColor: 'gray.200', _dark: { borderColor: 'gray.700' }, rounded: 'lg', p: '4' })"
      >
        <div :class="css({ display: 'flex', alignItems: 'flex-start', '& > * + *': { ml: '3' } })">
          <div :class="css({ flexShrink: '0' })">
            <img
              v-if="comment.avatar_url"
              :src="comment.avatar_url"
              :alt="comment.author"
              :class="css({ h: '8', w: '8', rounded: 'full' })"
              loading="lazy"
            />
            <div
              v-else
              :class="css({ h: '8', w: '8', rounded: 'full', bg: 'primary', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'sm', fontWeight: 'medium' })"
            >
              {{ comment.author.charAt(0).toUpperCase() }}
            </div>
          </div>

          <div :class="css({ flex: '1', minW: '0' })">
            <div :class="css({ display: 'flex', alignItems: 'center', '& > * + *': { ml: '2' }, mb: '1' })">
              <h4 :class="css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.900', _dark: { color: 'white' } })">
                {{ comment.author }}
              </h4>
              <span :class="css({ fontSize: 'xs', color: 'gray.500', _dark: { color: 'gray.400' } })">
                {{ formatDate(comment.timestamp) }}
              </span>
            </div>

            <div
              :class="cx('prose', css({ fontSize: 'sm', color: 'gray.700', _dark: { color: 'gray.300' }, maxW: 'none' }))"
              v-html="formatContent(comment.content)"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="discordInviteUrl" :class="css({ textAlign: 'center', pt: '4', borderTopWidth: '1px', borderColor: 'gray.200', _dark: { borderColor: 'gray.700' } })">
        <a
          :href="discordInviteUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="css({ display: 'inline-flex', alignItems: 'center', color: 'primary', _hover: { color: 'primary/90' }, _dark: { color: 'primary', _hover: { color: 'primary/90' } } })"
        >
          Want to share your thoughts? Join the discussion on Discord
          <svg :class="css({ ml: '1', w: '4', h: '4' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { css, cx } from "styled-system/css";
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
	return content
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.*?)\*/g, "<em>$1</em>")
		.replace(
			/`(.*?)`/g,
			'<code class="inline-code">$1</code>',
		)
		.replace(/\n/g, "<br>");
};

onMounted(() => {
	fetchComments();
});
</script>

<style scoped>
@reference "../../styles/global.css";
.comments-section {
  max-width: 100%;
}

.prose :deep(.inline-code) {
  background: var(--colors-gray-100);
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.dark .prose :deep(.inline-code) {
  background: var(--colors-gray-700);
}
</style>
