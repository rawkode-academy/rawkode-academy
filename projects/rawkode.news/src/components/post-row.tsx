import { Link, useLocation } from "react-router-dom";
import type { ApiPost } from "@/components/app-data";
import { formatRelativeTime, postPath } from "@/components/app-data";
import { MarkdownInline } from "@/components/markdown";
import { getCategoryBadgeClass } from "@/components/category-styles";
import { Badge } from "@/components/ui/badge";

export function PostRow({
  post,
  showCategoryBadge = false,
}: {
  post: ApiPost;
  showCategoryBadge?: boolean;
}) {
  const location = useLocation();
  const postUrl = post.url ?? undefined;
  const domain = postUrl ? new URL(postUrl).hostname.replace("www.", "") : null;
  const detailPath = postPath(post);
  const fromPath = `${location.pathname}${location.search}`;
  const summary = post.body?.trim() || null;

  return (
    <article className="px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              to={detailPath}
              state={{ from: fromPath }}
              className="min-w-0 text-[0.96rem] leading-6 font-semibold text-foreground hover:underline"
            >
              {post.title}
            </Link>
            {domain ? (
              <a
                href={postUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                ({domain})
              </a>
            ) : null}
            {showCategoryBadge ? (
              <Badge variant="outline" className={["md:hidden", getCategoryBadgeClass(post.category)].join(" ")}>
                {post.category}
              </Badge>
            ) : null}
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
            <span>•</span>
            <Link
              to={detailPath}
              state={{ from: fromPath }}
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              {post.commentCount} comments
            </Link>
          </div>
        </div>

        <div className="hidden pt-1 md:block">
          {showCategoryBadge ? (
            <Badge variant="outline" className={getCategoryBadgeClass(post.category)}>
              {post.category}
            </Badge>
          ) : null}
        </div>
      </div>
    </article>
  );
}
