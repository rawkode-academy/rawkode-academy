import * as React from "react";
import { ExternalLink } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ApiPost } from "@/components/app-data";
import { formatRelativeTime, postPath } from "@/components/app-data";
import { MarkdownInline } from "@/components/markdown";
import { getCategoryTextClass } from "@/components/category-styles";
import { getExternalDomainLabel } from "@/lib/domain-label";

export function PostRow({
  post,
  showCategoryBadge = false,
}: {
  post: ApiPost;
  showCategoryBadge?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const postUrl = post.url ?? undefined;
  const externalDomainLabel = postUrl ? getExternalDomainLabel(postUrl) : null;
  const hasExternalLink = Boolean(postUrl && externalDomainLabel);
  const detailPath = postPath(post);
  const fromPath = `${location.pathname}${location.search}`;
  const summary = post.body?.trim() || null;

  const navigateToDetails = React.useCallback(() => {
    navigate(detailPath, { state: { from: fromPath } });
  }, [detailPath, fromPath, navigate]);

  const handleLeftColumnClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) return;

      const target = event.target;
      if (target instanceof Element) {
        const interactive = target.closest(
          "a,button,input,select,textarea,label,[role='button'],[role='link']"
        );
        if (interactive) return;
      }

      navigateToDetails();
    },
    [navigateToDetails]
  );

  return (
    <article className="rkn-post-row">
      <div
        className={`min-w-0 space-y-1.5 cursor-pointer px-5 py-4 transition-colors hover:bg-muted/25 ${
          !hasExternalLink ? "md:col-span-2" : ""
        }`}
        onClick={handleLeftColumnClick}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="min-w-0 text-[0.96rem] leading-6 font-semibold text-foreground">{post.title}</h2>
        </div>

        {summary ? (
          <div className="text-sm text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            <MarkdownInline source={summary} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>by {post.author}</span>
          <span>•</span>
          <span>{formatRelativeTime(post.createdAt)}</span>
          {showCategoryBadge ? (
            <>
              <span>•</span>
              <span className={`${getCategoryTextClass(post.category)} font-semibold`}>{post.category}</span>
            </>
          ) : null}
          <span>•</span>
          <span>{post.commentCount} comments</span>
        </div>
      </div>
      {hasExternalLink ? (
        <div className="border-t border-border md:relative md:border-t-0 md:before:absolute md:before:top-4 md:before:bottom-4 md:before:left-0 md:before:border-l md:before:border-border md:before:content-['']">
          <a
            href={postUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-full min-h-10 w-full items-center justify-center gap-1.5 bg-transparent px-4 py-4 text-xs font-medium text-foreground hover:bg-muted/25 md:min-w-36"
            aria-label={`Open external source: ${externalDomainLabel}`}
          >
            <span className="font-mono tracking-wide">{externalDomainLabel}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      ) : null}
    </article>
  );
}
