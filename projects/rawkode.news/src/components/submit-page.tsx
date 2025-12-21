import * as React from "react";
import MDEditor from "@uiw/react-md-editor";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { Form, useActionData, useLocation, useNavigation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type PostCategory,
  postCategories,
} from "@/components/app-data";
import { getCategoryBadgeClass, getCategoryRingClass } from "@/components/category-styles";
import { useSession } from "@/components/session";
import { cn } from "@/lib/utils";

export default function SubmitPage() {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [category, setCategory] = React.useState<PostCategory>("rka");
  const location = useLocation();
  const navigation = useNavigation();
  const actionData = useActionData() as { error?: string } | undefined;
  const error = actionData?.error ?? null;
  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;
  const allowedCategories =
    sessionQuery.data?.permissions?.allowedCategories ?? postCategories;
  const isAuthReady = !sessionQuery.isLoading;
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/submit";
  }, [location]);
  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const isSubmitting = navigation.state === "submitting";
  const pageHeader = (
    <header className="flex flex-col gap-1">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Submit
      </p>
    </header>
  );

  React.useEffect(() => {
    void import("@uiw/react-md-editor/markdown-editor.css");
    void import("@uiw/react-markdown-preview/markdown.css");
  }, []);

  React.useEffect(() => {
    if (!allowedCategories.includes(category)) {
      setCategory(allowedCategories[0] ?? "show");
    }
  }, [allowedCategories, category]);

  if (!isAuthReady) {
    return (
      <main className="flex w-full flex-col gap-6 py-6">
        {pageHeader}
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Checking sign-in…</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex w-full flex-col gap-6 py-6">
        {pageHeader}
        <Card>
          <CardContent className="flex flex-col gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              Sign in to submit a post.
            </p>
            <div>
              <Button variant="secondary" size="sm" asChild>
                <a href={signInUrl}>Sign in</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      {pageHeader}
      <Card>
        <CardContent>
          <Form method="post" className="space-y-4">
            <fieldset className="space-y-4" disabled={isSubmitting}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="A clear, honest title"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Category</legend>
                <div className="flex flex-wrap gap-2">
                  {allowedCategories.map((item) => {
                    const inputId = `category-${item}`;
                    const isSelected = category === item;
                    return (
                      <div key={item} className="flex items-center">
                        <input
                          id={inputId}
                          type="radio"
                          name="category"
                          value={item}
                          checked={isSelected}
                          onChange={() => setCategory(item)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className={cn(
                            "cursor-pointer select-none rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                            getCategoryBadgeClass(item),
                            isSelected
                              ? `ring-2 ring-offset-2 ring-offset-background ${getCategoryRingClass(
                                  item
                                )}`
                              : "opacity-80 hover:opacity-100"
                          )}
                        >
                          {item}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  name="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2 rkn-md-editor" data-color-mode="light">
                <label className="text-sm font-medium">Summary (Markdown)</label>
                <div className="grid gap-4 lg:grid-cols-2">
                  <MDEditor
                    value={notes}
                    onChange={(value) => setNotes(value ?? "")}
                    height={220}
                    preview="edit"
                    visibleDragbar={false}
                    textareaProps={{
                      placeholder: "Context, why it matters, or a short summary.",
                    }}
                    className="rounded-md border border-input bg-background"
                  />
                  <MarkdownPreview
                    source={notes || "Nothing to preview yet."}
                    className="min-h-[220px] rounded-md border border-input bg-background p-4 text-sm leading-relaxed overflow-y-auto"
                  />
                </div>
                <input type="hidden" name="body" value={notes} />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                type="submit"
                className="w-full"
                disabled={!title.trim() || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit to RKN"}
              </Button>
            </fieldset>
          </Form>
          <style>{`
            .rkn-md-editor .w-md-editor {
              background-color: var(--background);
              color: var(--foreground);
              border: 1px solid var(--border);
              border-radius: 0.5rem;
              box-shadow: none;
            }
            .rkn-md-editor .w-md-editor-toolbar {
              background-color: var(--muted);
              border-bottom: 1px solid var(--border);
              padding: 0.35rem;
              border-top-left-radius: 0.5rem;
              border-top-right-radius: 0.5rem;
            }
            .rkn-md-editor .w-md-editor-toolbar li button {
              color: var(--foreground);
              opacity: 0.75;
              border-radius: 0.375rem;
            }
            .rkn-md-editor .w-md-editor-toolbar li button:hover {
              background-color: var(--accent);
              opacity: 1;
            }
            .rkn-md-editor .w-md-editor-text-input,
            .rkn-md-editor .w-md-editor-text-pre,
            .rkn-md-editor .wmde-markdown {
              font-family: var(--font-body);
              font-size: 0.875rem;
              line-height: 1.6;
              color: var(--foreground);
            }
            .rkn-md-editor .w-md-editor-text-pre,
            .rkn-md-editor .wmde-markdown {
              background-color: transparent;
            }
            .rkn-md-editor .w-md-editor-preview {
              background-color: transparent;
              box-shadow: none;
            }
            .rkn-md-editor .wmde-markdown {
              background-color: transparent;
            }
            .rkn-md-editor .wmde-markdown pre,
            .rkn-md-editor .wmde-markdown code {
              background-color: var(--muted);
            }
            .rkn-md-editor .wmde-markdown pre {
              border: 1px solid var(--border);
              border-radius: 0.5rem;
              padding: 0.75rem;
            }
            .rkn-md-editor .wmde-markdown ul,
            .rkn-md-editor .wmde-markdown ol {
              list-style-position: outside;
              padding-left: 1.25rem;
              margin: 0.5rem 0;
            }
            .rkn-md-editor .wmde-markdown ul {
              list-style-type: disc;
            }
            .rkn-md-editor .wmde-markdown ol {
              list-style-type: decimal;
            }
            .rkn-md-editor .wmde-markdown li {
              margin: 0.25rem 0;
            }
            .rkn-md-editor .w-md-editor-content {
              border-bottom-left-radius: 0.5rem;
              border-bottom-right-radius: 0.5rem;
            }
            .rkn-md-editor .w-md-editor-fullscreen {
              background-color: var(--background);
            }
          `}</style>
        </CardContent>
      </Card>
    </main>
  );
}
