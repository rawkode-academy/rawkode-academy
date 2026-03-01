<script lang="ts">
  import { commentAnchor, formatCountLabel, formatRelativeTime, type CommentNode } from "@/lib/contracts";
  import { COMMENT_BODY_MAX_LENGTH } from "@/lib/input-limits";
  import {
    buttonPrimarySmClass,
    buttonSecondarySmClass,
    textActionMutedXsClass,
    textLinkMutedXsClass,
    textareaClass,
  } from "@/lib/ui-classes";

  export let comment: CommentNode;
  export let depth = 0;
  export let canReply = false;
  export let isSubmitting = false;
  export let returnTo = "/";
  export let onReply: (body: string, parentId: string) => Promise<boolean> = async () => false;

  let isCollapsed = false;
  let isReplying = false;
  let replyText = "";
  let bodyId = "";
  let replyFormId = "";
  let replyCountLabel = "";
  $: bodyId = `${commentAnchor(comment)}-body`;
  $: replyFormId = `${commentAnchor(comment)}-reply`;
  $: replyCountLabel = formatCountLabel(comment.replies.length, "reply", "replies");

  const submitReply = async () => {
    const value = replyText.trim();
    if (!value || isSubmitting) {
      return;
    }

    const success = await onReply(value, comment.id);
    if (success) {
      replyText = "";
      isReplying = false;
    }
  };
</script>

<div class="rkn-thread-node space-y-3" style={`--rkn-thread-depth: ${depth ? Math.min(depth, 5) : 0};`}>
  <article
    id={commentAnchor(comment)}
    class="border-l border-border/75 px-3 py-2 text-sm target:border-primary/60 target:bg-primary/10"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <div class="flex flex-wrap items-center gap-2">
        <span class="break-words font-semibold text-foreground" dir="auto">{comment.author}</span>
        <span>·</span>
        <span>{formatRelativeTime(comment.createdAt)}</span>
      </div>
      <div class="flex items-center gap-3">
        <a
          href={`${returnTo}#${commentAnchor(comment)}`}
          class={textLinkMutedXsClass}
        >
          Permalink
        </a>
        <button
          type="button"
          class={textActionMutedXsClass}
          aria-expanded={isCollapsed ? "false" : "true"}
          aria-controls={bodyId}
          on:click={() => {
            isCollapsed = !isCollapsed;
          }}
        >
          {isCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>
    </div>

    {#if !isCollapsed}
      <p id={bodyId} class="mt-2 break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground/95" dir="auto">{comment.body}</p>

      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{replyCountLabel}</span>
        {#if canReply}
          <button
            type="button"
            class={`inline-flex items-center gap-1 ${textActionMutedXsClass}`}
            aria-expanded={isReplying ? "true" : "false"}
            aria-controls={replyFormId}
            on:click={() => {
              isReplying = !isReplying;
            }}
          >
            Reply
          </button>
        {/if}
      </div>

      {#if canReply && isReplying}
        <div id={replyFormId} class="mt-3 space-y-3 border-l-2 border-primary/25 bg-muted/15 px-3 py-3">
          <textarea
            bind:value={replyText}
            placeholder="Add a specific, useful reply"
            maxlength={COMMENT_BODY_MAX_LENGTH}
            dir="auto"
            class={`${textareaClass} min-h-[90px]`}
          ></textarea>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class={buttonPrimarySmClass}
              disabled={isSubmitting || !replyText.trim()}
              on:click={submitReply}
            >
              {isSubmitting ? "Posting reply…" : "Add reply"}
            </button>
            <button
              type="button"
              class={buttonSecondarySmClass}
              on:click={() => {
                replyText = "";
                isReplying = false;
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </article>

  {#if !isCollapsed && comment.replies.length}
    <div class="rkn-thread-branch space-y-3">
      {#each comment.replies as reply (reply.id)}
        <svelte:self
          comment={reply}
          depth={depth + 1}
          {canReply}
          {isSubmitting}
          {returnTo}
          {onReply}
        />
      {/each}
    </div>
  {/if}
</div>
