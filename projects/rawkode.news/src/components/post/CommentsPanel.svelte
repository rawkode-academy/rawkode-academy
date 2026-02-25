<script lang="ts">
  import { actions } from "astro:actions";
  import { buildCommentTree, commentAnchor, type ApiComment, type CommentNode } from "@/lib/contracts";
  import { buttonPrimarySmClass, buttonSecondarySmClass, textareaClass } from "@/lib/ui-classes";
  import CommentBranch from "@/components/post/CommentBranch.svelte";
  import { onMount, tick } from "svelte";

  export let postId: string;
  export let returnTo: string;
  export let canReply = false;
  export let signInUrl = "/api/auth/sign-in?returnTo=/";
  export let initialComments: ApiComment[] = [];
  export let initialError: string | null = null;

  let comments: ApiComment[] = [...initialComments];
  let thread: CommentNode[] = buildCommentTree(comments);

  let newComment = "";
  let isSubmitting = false;
  let errorMessage: string | null = initialError;

  $: thread = buildCommentTree(comments);

  const scrollToHash = async (hash: string) => {
    const id = decodeURIComponent(hash.replace(/^#/, "")).trim();
    if (!id) {
      return;
    }

    await tick();
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center" });
    });
  };

  const updateHash = async (hash: string) => {
    const nextPath = `${window.location.pathname}${window.location.search}${hash}`;
    history.replaceState(history.state, "", nextPath);
    await scrollToHash(hash);
  };

  const submitComment = async (body: string, parentId?: string) => {
    const value = body.trim();
    if (!value || isSubmitting) {
      return false;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const payload = new FormData();
      payload.set("postId", postId);
      payload.set("body", value);
      payload.set("returnTo", returnTo);
      if (parentId) {
        payload.set("parentId", parentId);
      }

      const result = await actions.createComment(payload);
      if (result.error) {
        errorMessage = result.error.message;
        return false;
      }

      const created = result.data?.created;
      if (created) {
        comments = [...comments, created];
      }

      const redirectTo = result.data?.redirectTo;
      if (typeof redirectTo === "string") {
        const hashIndex = redirectTo.indexOf("#");
        if (hashIndex >= 0) {
          const hash = redirectTo.slice(hashIndex);
          if (hash.length > 1) {
            await updateHash(hash);
          }
        }
      } else if (created) {
        await updateHash(`#${commentAnchor(created)}`);
      }

      return true;
    } finally {
      isSubmitting = false;
    }
  };

  const submitTopLevel = async () => {
    const success = await submitComment(newComment);
    if (success) {
      newComment = "";
    }
  };

  onMount(() => {
    if (window.location.hash) {
      void scrollToHash(window.location.hash);
    }
  });
</script>

{#if canReply}
  <div class="space-y-3 rounded-none border border-border bg-muted/30 p-4">
    <textarea
      bind:value={newComment}
      placeholder="Add context, pushback, or supporting links."
      class={`${textareaClass} min-h-[120px]`}
      disabled={isSubmitting}
    ></textarea>
    <div class="flex items-center justify-start">
      <button
        type="button"
        class={buttonPrimarySmClass}
        disabled={isSubmitting || !newComment.trim()}
        on:click={submitTopLevel}
      >
        {isSubmitting ? "Posting..." : "Post comment"}
      </button>
    </div>
  </div>
{:else}
  <div class="rounded-none border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
    <p>Sign in to join the discussion.</p>
    <div class="mt-3">
      <a
        href={signInUrl}
        data-astro-prefetch="false"
        data-astro-reload
        class={buttonSecondarySmClass}
      >
        Sign in
      </a>
    </div>
  </div>
{/if}

{#if errorMessage}
  <p class="text-sm text-destructive">{errorMessage}</p>
{/if}

<div class="mt-2 space-y-4">
  {#if thread.length === 0}
    <p class="text-sm text-muted-foreground">No comments yet.</p>
  {/if}

  {#each thread as comment (comment.id)}
    <CommentBranch
      {comment}
      depth={0}
      {canReply}
      {isSubmitting}
      {returnTo}
      onReply={submitComment}
    />
  {/each}
</div>
