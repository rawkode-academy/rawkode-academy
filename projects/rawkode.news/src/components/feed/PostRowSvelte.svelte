<script lang="ts">
  import type { ApiPost } from "@/lib/contracts";
  import { formatCountLabel, formatRelativeTime, postPath } from "@/lib/contracts";
  import { getExternalDomainLabel } from "@/lib/domain-label";
  import { stripMarkdownToText, truncateDescription } from "@/lib/seo";

  export let post: ApiPost;
  export let from: string | undefined = undefined;

  $: postUrl = post.url ?? undefined;
  $: externalDomainLabel = postUrl ? getExternalDomainLabel(postUrl) : null;
  $: hasExternalLink = Boolean(postUrl && externalDomainLabel);
  $: detailPathBase = postPath(post);
  $: detailPath = from ? `${detailPathBase}?from=${encodeURIComponent(from)}` : detailPathBase;
  $: summary = post.body?.trim()
    ? truncateDescription(stripMarkdownToText(post.body), 240)
    : null;
  $: commentCountLabel = formatCountLabel(post.commentCount, "comment", "comments");
</script>

<article class="rkn-post-row">
  <div
    class={`min-w-0 cursor-pointer px-5 py-4 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/25 focus-within:bg-muted/35 ${!hasExternalLink ? "md:col-span-2" : ""}`}
  >
    <a href={detailPath} class="block min-w-0 space-y-1.5 rounded-none outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2
          class="min-w-0 break-words text-[1.03rem] leading-[1.35] font-semibold text-foreground"
          title={post.title}
          dir="auto"
        >
          {post.title}
        </h2>
      </div>

      {#if summary}
        <p
          class="break-words text-sm text-muted-foreground [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
          dir="auto"
        >
          {summary}
        </p>
      {/if}

      <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span class="max-w-full break-words" dir="auto">by {post.author}</span>
        <span>•</span>
        <span>{formatRelativeTime(post.createdAt)}</span>
        <span>•</span>
        <span>{commentCountLabel}</span>
        {#if post.tags.length > 0}
          <span>•</span>
          <span class="flex flex-wrap items-center gap-1">
            {#each post.tags as tag (tag.id)}
              <span
                class="inline-flex max-w-full items-center rounded-md border border-border bg-muted px-1 py-0 text-xs leading-4 font-medium text-foreground"
                title={tag.slug}
                dir="auto"
              >
                {tag.slug}
              </span>
            {/each}
          </span>
        {/if}
      </div>
    </a>
  </div>

  {#if hasExternalLink && postUrl}
    <div class="rkn-source-link-divider border-t border-border md:relative md:border-t-0">
      <a
        href={postUrl}
        target="_blank"
        rel="noreferrer noopener"
        class="inline-flex h-full min-h-[var(--rkn-control-sm-height)] w-full items-center justify-center gap-1.5 bg-transparent px-4 py-4 text-xs font-medium text-foreground outline-none transition-[background-color,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring/60 md:min-w-36"
        aria-label={`Open external source: ${externalDomainLabel}`}
      >
        <span class="max-w-[14rem] truncate font-mono tracking-wide" title={externalDomainLabel}>
          {externalDomainLabel}
        </span>
        <span class="text-muted-foreground">↗</span>
      </a>
    </div>
  {/if}
</article>
