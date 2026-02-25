  <script lang="ts">
  import { commentAnchor, formatRelativeTime, type CommentNode } from "@/lib/contracts";
  import { buttonPrimarySmClass, buttonSecondarySmClass, textareaClass } from "@/lib/ui-classes";

  export let comment: CommentNode;
  export let depth = 0;
  export let canReply = false;
  export let isSubmitting = false;
  export let returnTo = "/";
  export let onReply: (body: string, parentId: string) => Promise<boolean> = async () => false;

  let isCollapsed = false;
  let isReplying = false;
  let replyText = "";

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

<div class="space-y-3" style={`margin-left: ${depth ? Math.min(depth, 5) * 14 : 0}px`}>
  <article
    id={commentAnchor(comment)}
    class="rounded-none border border-border bg-card p-4 text-sm target:border-primary/45 target:bg-primary/10 target:ring-2 target:ring-primary/20"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold text-foreground">{comment.author}</span>
        <span>·</span>
        <span>{formatRelativeTime(comment.createdAt)}</span>
      </div>
      <div class="flex items-center gap-3">
        <a
          href={`${returnTo}#${commentAnchor(comment)}`}
          class="text-xs text-muted-foreground hover:text-foreground"
        >
          permalink
        </a>
        <button
          type="button"
          class="text-xs font-medium text-muted-foreground hover:text-foreground"
          on:click={() => {
            isCollapsed = !isCollapsed;
          }}
        >
          {isCollapsed ? "expand" : "collapse"}
        </button>
      </div>
    </div>

    {#if !isCollapsed}
      <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/95">{comment.body}</p>

      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{comment.replies.length} replies</span>
        {#if canReply}
          <button
            type="button"
            class="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
            on:click={() => {
              isReplying = !isReplying;
            }}
          >
            reply
          </button>
        {/if}
      </div>

      {#if canReply && isReplying}
        <div class="mt-3 space-y-3 rounded-none border border-border bg-muted/30 p-3">
          <textarea
            bind:value={replyText}
            placeholder="Add a useful reply"
            class={`${textareaClass} min-h-[90px]`}
          ></textarea>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class={buttonPrimarySmClass}
              disabled={isSubmitting || !replyText.trim()}
              on:click={submitReply}
            >
              {isSubmitting ? "Posting..." : "Post reply"}
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
    <div class="space-y-3 border-l border-border/75 pl-3">
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
