import { Link } from "react-router-dom";
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
  rank: number;
  showCategoryBadge?: boolean;
}) {
  const domain = post.url ? new URL(post.url).hostname.replace("www.", "") : null;
  const detailPath = postPath(post);
  const summary = post.body?.trim() || "link submission";
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <div className="min-w-0 flex-1 truncate">
            <Link to={detailPath} className="font-semibold hover:underline">
              {post.title}
            </Link>
            {domain ? (
              <>
                <span className="text-muted-foreground"> · </span>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground"
                >
                  {domain}
                </a>
              </>
            ) : null}
          </div>
          {showCategoryBadge ? (
            <Badge
              variant="outline"
              className={[
                "h-5 shrink-0 px-2 text-[10px] uppercase tracking-wide leading-none self-center",
                getCategoryBadgeClass(post.category),
              ].join(" ")}
            >
              {post.category}
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          <MarkdownInline source={summary} />
          <span> · </span>
          <span>by {post.author}</span>
          <span> · </span>
          <span>{formatRelativeTime(post.createdAt)}</span>
          <span> · </span>
          <span>{post.commentCount} comments</span>
        </div>
      </div>

    </div>
  );
}
