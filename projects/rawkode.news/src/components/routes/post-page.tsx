import * as React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MarkdownPreview from "@uiw/react-markdown-preview/nohighlight";
import { CornerDownRight, ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiComment, ApiPost, CommentNode, Paginated } from "@/components/app-data";
import { buildCommentTree, commentAnchor, formatRelativeTime, postPath } from "@/components/app-data";
import { getCategoryBadgeClass } from "@/components/category-styles";
import { commentsQueryOptions, postQueryOptions } from "@/components/query-client";
import { useSession } from "@/components/session";
import { cn } from "@/lib/utils";

function CommentBlock({
  comment,
  depth,
  onReply,
  basePath,
  activeAnchor,
  canReply,
  linkState,
}: {
  comment: CommentNode;
  depth: number;
  onReply: (text: string, parentId?: string) => void;
  basePath: string;
  activeAnchor: string;
  canReply: boolean;
  linkState: unknown;
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isReplying, setIsReplying] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const anchor = commentAnchor(comment);
  const isActive = activeAnchor === anchor;

  return (
    <div className="space-y-3" style={{ marginLeft: depth ? Math.min(depth, 5) * 14 : 0 }}>
      <article
        id={anchor}
        className={cn(
          "rounded-none border border-border bg-card p-4 text-sm",
          isActive && "border-primary/45 bg-primary/10 ring-2 ring-primary/20"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{comment.author}</span>
            <span>·</span>
            <span>{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`${basePath}#${anchor}`}
              replace
              state={linkState}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link2 className="h-3 w-3" />
              permalink
            </Link>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed((value) => !value)}
            >
              {isCollapsed ? "expand" : "collapse"}
            </button>
          </div>
        </div>

        {!isCollapsed ? (
          <>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/95">{comment.body}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{comment.replies.length} replies</span>
              {canReply ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setIsReplying((value) => !value)}
                >
                  <CornerDownRight className="h-3 w-3" />
                  reply
                </button>
              ) : null}
            </div>

            {canReply && isReplying ? (
              <div className="mt-3 space-y-3 rounded-none border border-border bg-muted/30 p-3">
                <Textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Add a useful reply"
                  className="min-h-[90px]"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onReply(replyText, comment.id);
                      setReplyText("");
                      setIsReplying(false);
                    }}
                    disabled={!replyText.trim()}
                  >
                    Post reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReplyText("");
                      setIsReplying(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </article>

      {!isCollapsed && comment.replies.length ? (
        <div className="space-y-3 border-l border-border/75 pl-3">
          {comment.replies.map((reply) => (
            <CommentBlock
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              basePath={basePath}
              activeAnchor={activeAnchor}
              canReply={canReply}
              linkState={linkState}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const postId = id?.trim() ?? "";
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = React.useState("");
  const [pendingAnchor, setPendingAnchor] = React.useState<string | null>(null);
  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;
  const isAuthReady = !sessionQuery.isLoading;
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/";
  }, [location]);

  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  const postQuery = useQuery({
    ...postQueryOptions(postId),
    enabled: Boolean(postId),
  });

  React.useEffect(() => {
    void import("@uiw/react-markdown-preview/markdown.css");
  }, []);

  const post = postQuery.data;
  const canonicalPath = post ? postPath(post) : null;
  const returnPath = React.useMemo(() => {
    const state = location.state as { from?: string } | null;
    const from = state?.from;
    if (!from || !from.startsWith("/")) {
      return "/";
    }
    if (from.startsWith("/item/")) {
      return "/";
    }
    return from;
  }, [location.state]);

  const handleBack = React.useCallback(() => {
    navigate(returnPath);
  }, [navigate, returnPath]);

  const commentsQuery = useQuery({
    ...commentsQueryOptions(postId),
    enabled: Boolean(postId),
  });

  const thread = React.useMemo(() => buildCommentTree(commentsQuery.data ?? []), [commentsQuery.data]);

  const commentMutation = useMutation({
    mutationFn: async ({
      body,
      parentId,
    }: {
      body: string;
      parentId?: string;
    }) => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body, parentId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create comment");
      }

      return (await response.json()) as ApiComment;
    },
    onSuccess: (created) => {
      setPendingAnchor(commentAnchor(created));

      queryClient.setQueryData<ApiComment[]>(["comments", postId], (current) =>
        current ? [...current, created] : [created]
      );

      queryClient.setQueryData<ApiPost>(["post", postId], (current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current
      );

      if (post) {
        queryClient.setQueriesData<Paginated<ApiPost>>({ queryKey: ["posts"] }, (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item
                ),
              }
            : current
        );
      }
    },
  });

  React.useEffect(() => {
    if (!pendingAnchor || !canonicalPath) return;
    navigate(`${canonicalPath}#${pendingAnchor}`, { replace: true, state: location.state });
    setPendingAnchor(null);
  }, [canonicalPath, location.state, navigate, pendingAnchor]);

  React.useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) {
      el.scrollIntoView({ block: "center" });
    }
  }, [location.hash, thread]);

  const addComment = (text: string, parentId?: string) => {
    if (!user || !text.trim() || !postId || commentMutation.isPending) {
      return;
    }
    commentMutation.mutate({ body: text.trim(), parentId });
  };

  if (postQuery.isLoading) {
    return (
      <main className="space-y-4 py-7">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          Back
        </Button>
        <section className="rkn-panel p-6 text-sm text-muted-foreground">Loading post…</section>
      </main>
    );
  }

  if (postQuery.isError || !post || !canonicalPath) {
    return (
      <main className="space-y-4 py-7">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          Back
        </Button>
        <section className="rkn-panel p-6 text-sm text-muted-foreground">Could not load this post yet.</section>
      </main>
    );
  }

  return (
    <main className="space-y-6 py-7">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          Back to feed
        </Button>
      </div>

      <article>
        <section className="rkn-panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={getCategoryBadgeClass(post.category)}>
              {post.category}
            </Badge>
            <span>posted {formatRelativeTime(post.createdAt)}</span>
          </div>

          <h1 className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-[1.2] tracking-tight">{post.title}</h1>

          <p className="text-sm text-muted-foreground">
            Shared by <span className="font-semibold text-foreground">{post.author}</span>
          </p>

          {post.url ? (
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Open original source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          {post.body ? (
            <>
              <MarkdownPreview
                source={post.body}
                className="rkn-markdown rkn-prose"
                wrapperElement={{ "data-color-mode": "light" }}
              />

              <style>{`
                .rkn-markdown {
                  background-color: transparent;
                  color: var(--foreground);
                }

                .rkn-markdown ul,
                .rkn-markdown ol {
                  list-style-position: outside;
                  padding-left: 1.25rem;
                }
              `}</style>
            </>
          ) : null}
        </section>
      </article>

      <section id="discussion" className="rkn-panel space-y-5 p-5 sm:p-6">
        <header className="space-y-1">
          <p className="rkn-kicker">Discussion</p>
          <h2 className="font-display text-xl font-semibold">Community thread</h2>
          <p className="text-sm text-muted-foreground">Be clear, be respectful, and cite what matters.</p>
        </header>

        {isAuthReady && user ? (
          <div className="space-y-3 rounded-none border border-border bg-muted/30 p-4">
            <Textarea
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder="Add context, pushback, or supporting links."
              className="min-h-[120px]"
              disabled={commentMutation.isPending}
            />
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                disabled={commentMutation.isPending || !newComment.trim()}
                onClick={() => {
                  addComment(newComment);
                  setNewComment("");
                }}
              >
                {commentMutation.isPending ? "Posting..." : "Post comment"}
              </Button>
            </div>
          </div>
        ) : isAuthReady ? (
          <div className="rounded-none border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
            <p>Sign in to join the discussion.</p>
            <div className="mt-3">
              <Button variant="secondary" size="sm" asChild>
                <a href={signInUrl}>Sign in</a>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {commentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading comments…</p> : null}
          {commentsQuery.isError ? (
            <p className="text-sm text-muted-foreground">Could not load comments yet.</p>
          ) : null}
          {!commentsQuery.isLoading && thread.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : null}

          {thread.map((comment) => (
            <CommentBlock
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={addComment}
              basePath={canonicalPath}
              activeAnchor={location.hash.slice(1)}
              canReply={Boolean(user)}
              linkState={location.state}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
