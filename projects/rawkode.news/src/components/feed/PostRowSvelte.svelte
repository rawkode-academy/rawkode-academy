<script lang="ts">
  import type { ApiPost } from "@/lib/contracts";
  import { formatRelativeTime, postPath } from "@/lib/contracts";
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
</script>

<article class="rkn-post-row">
  <div
    class={`min-w-0 cursor-pointer px-5 py-4 transition-colors hover:bg-muted/25 ${!hasExternalLink ? "md:col-span-2" : ""}`}
  >
    <a href={detailPath} class="block min-w-0 space-y-1.5">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 class="min-w-0 text-[0.96rem] leading-6 font-semibold text-foreground">{post.title}</h2>
      </div>

      {#if summary}
        <p class="text-sm text-muted-foreground [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {summary}
        </p>
      {/if}

      <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>by {post.author}</span>
        <span>•</span>
        <span>{formatRelativeTime(post.createdAt)}</span>
        <span>•</span>
        <span>{post.commentCount} comments</span>
        {#if post.tags.length > 0}
          <span>•</span>
          <span class="flex flex-wrap items-center gap-1">
            {#each post.tags as tag (tag.id)}
              <span
                class="inline-flex items-center rounded-md border border-border bg-muted px-1 py-0 text-xs leading-4 font-medium text-foreground"
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
    <div class="border-t border-border md:relative md:border-t-0 md:before:absolute md:before:top-4 md:before:right-auto md:before:bottom-4 md:before:left-0 md:before:border-l md:before:border-border md:before:content-['']">
      <a
        href={postUrl}
        target="_blank"
        rel="noreferrer noopener"
        class="inline-flex h-full min-h-10 w-full items-center justify-center gap-1.5 bg-transparent px-4 py-4 text-xs font-medium text-foreground hover:bg-muted/25 md:min-w-36"
        aria-label={`Open external source: ${externalDomainLabel}`}
      >
        <span class="font-mono tracking-wide">{externalDomainLabel}</span>
        <span class="text-muted-foreground">↗</span>
      </a>
    </div>
  {/if}
</article>
