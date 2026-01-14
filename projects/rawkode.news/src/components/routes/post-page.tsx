import * as React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Link2 } from "lucide-react";
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
}: {
  comment: CommentNode;
  depth: number;
  onReply: (text: string, parentId?: number) => void;
  basePath: string;
  activeAnchor: string;
  canReply: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isReplying, setIsReplying] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const anchor = commentAnchor(comment);
  const isActive = activeAnchor === anchor;

  return (
    <div className="space-y-3" style={{ marginLeft: depth ? depth * 16 : 0 }}>
      <div
        id={anchor}
        className={cn(
          "group rounded-lg border border-border bg-transparent p-4 text-sm transition",
          isActive && "ring-2 ring-primary/40 bg-primary/5"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{comment.author}</span>
            <span>•</span>
            <span>{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`${basePath}#${anchor}`}
              className="flex items-center gap-1 text-xs font-medium text-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <Link2 className="h-3 w-3" />
              permalink
            </Link>
            <button
              type="button"
              className="text-xs font-medium text-foreground/70 hover:text-foreground"
              onClick={() => setIsCollapsed((value) => !value)}
            >
              {isCollapsed ? "expand" : "collapse"}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            <p className="mt-2 text-sm text-foreground/90">{comment.body}</p>
            {canReply ? (
              <>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="font-medium text-foreground/70 hover:text-foreground"
                    onClick={() => setIsReplying((value) => !value)}
                  >
                    reply
                  </button>
                  <span>•</span>
                  <span>{comment.replies.length} replies</span>
                </div>

                <div
                  className={cn(
                    "grid transition-all duration-200",
                    isReplying
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="relative mt-3 space-y-3 rounded-lg border border-border bg-background/90 p-4 shadow-sm before:absolute before:-left-2 before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-primary">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">replying</Badge>
                        <span className="font-medium text-foreground">
                          @{comment.author}
                        </span>
                      </div>
                      <Textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Add a thoughtful reply"
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
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground">
                <span>{comment.replies.length} replies</span>
              </div>
            )}
          </>
        )}
      </div>

      {!isCollapsed && comment.replies.length ? (
        <div className="space-y-3 border-l border-border/60 pl-4">
          {comment.replies.map((reply) => (
            <CommentBlock
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              basePath={basePath}
              activeAnchor={activeAnchor}
              canReply={canReply}
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
  const postId = Number(id);
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
    enabled: Number.isFinite(postId),
  });
  React.useEffect(() => {
    void import("@uiw/react-markdown-preview/markdown.css");
  }, []);

  const post = postQuery.data;
  const canonicalPath = post ? postPath(post) : null;
  const handleBack = React.useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }, [navigate]);
  const backControl = (
    <div className="flex items-center">
      <Button variant="ghost" size="sm" onClick={handleBack}>
        Back
      </Button>
    </div>
  );

  const commentsQuery = useQuery({
    ...commentsQueryOptions(postId),
    enabled: Number.isFinite(postId),
  });

  const thread = React.useMemo(
    () => buildCommentTree(commentsQuery.data ?? []),
    [commentsQuery.data]
  );

  const commentMutation = useMutation({
    mutationFn: async ({
      body,
      parentId,
    }: {
      body: string;
      parentId?: number;
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
      queryClient.setQueryData<ApiComment[]>(
        ["comments", postId],
        (current) => (current ? [...current, created] : [created])
      );
      queryClient.setQueryData<ApiPost>(["post", postId], (current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current
      );
      if (post) {
        queryClient.setQueriesData<Paginated<ApiPost>>(
          { queryKey: ["posts"] },
          (current) =>
            current
              ? {
                  ...current,
                  items: current.items.map((item) =>
                    item.id === postId
                      ? { ...item, commentCount: item.commentCount + 1 }
                      : item
                  ),
                }
              : current
        );
      }
    },
  });

  React.useEffect(() => {
    if (!pendingAnchor || !canonicalPath) return;
    navigate(`${canonicalPath}#${pendingAnchor}`);
    setPendingAnchor(null);
  }, [canonicalPath, navigate, pendingAnchor]);

  React.useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [location.hash, thread]);

  const addComment = (text: string, parentId?: number) => {
    if (
      !user ||
      !text.trim() ||
      !Number.isFinite(postId) ||
      commentMutation.isPending
    ) {
      return;
    }
    commentMutation.mutate({ body: text.trim(), parentId });
  };

  if (postQuery.isLoading) {
    return (
      <main className="flex w-full flex-col gap-6 py-6">
        {backControl}
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Loading post…
          </CardContent>
        </Card>
      </main>
    );
  }

  if (postQuery.isError || !post || !canonicalPath) {
    return (
      <main className="flex w-full flex-col gap-6 py-6">
        {backControl}
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Could not load this post yet.
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="flex w-full flex-col gap-6 py-6">
      {backControl}
      <Card>
        <CardHeader>
          <CardTitle>{post.title}</CardTitle>
          <CardDescription>
            {post.commentCount} comments · by {post.author}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {post.body ? (
            <>
              <MarkdownPreview
                source={post.body}
                className="rkn-markdown bg-background text-sm leading-relaxed"
                wrapperElement={{ "data-color-mode": "light" }}
              />
              <style>{`
                .rkn-markdown {
                  background-color: var(--background);
                  color: var(--foreground);
                }
                .rkn-markdown pre,
                .rkn-markdown code {
                  background-color: var(--muted);
                }
                .rkn-markdown pre {
                  border: 1px solid var(--border);
                  border-radius: 0.5rem;
                  padding: 0.75rem;
                }
                .rkn-markdown ul,
                .rkn-markdown ol {
                  list-style-position: outside;
                  padding-left: 1.25rem;
                  margin: 0.5rem 0;
                }
                .rkn-markdown ul {
                  list-style-type: disc;
                }
                .rkn-markdown ol {
                  list-style-type: decimal;
                }
                .rkn-markdown li {
                  margin: 0.25rem 0;
                }
              `}</style>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">link submission</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className={getCategoryBadgeClass(post.category)}
            >
              {post.category}
            </Badge>
            <span>{formatRelativeTime(post.createdAt)}</span>
            {post.url ? (
              <>
                <span>•</span>
                <a href={post.url} className="underline-offset-4 hover:underline">
                  Open original
                </a>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discussion</CardTitle>
          <CardDescription>Threaded, ranked by clarity and intent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAuthReady && user ? (
            <div className="space-y-3 rounded-lg border border-border bg-transparent p-4">
              <p className="text-sm font-medium">Add to the thread</p>
              <Textarea
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                placeholder="Share context, links, or a useful counterpoint."
                className="min-h-[110px]"
                disabled={commentMutation.isPending}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Be clear. Be kind. Cite sources.</span>
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
            <div className="rounded-lg border border-border bg-transparent p-4 text-sm text-muted-foreground">
              <p>Sign in to join the discussion.</p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" asChild>
                  <a href={signInUrl}>Sign in</a>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-5">
            {commentsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading comments…</p>
            ) : null}
            {commentsQuery.isError ? (
              <p className="text-sm text-muted-foreground">
                Could not load comments yet.
              </p>
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
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
