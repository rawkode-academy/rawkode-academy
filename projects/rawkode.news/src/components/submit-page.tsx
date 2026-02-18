import * as React from "react";
import MDEditor from "@uiw/react-md-editor/nohighlight";
import MarkdownPreview from "@uiw/react-markdown-preview/nohighlight";
import { Form, useActionData, useLocation, useNavigation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PostCategory, postCategories } from "@/components/app-data";
import { getCategoryRingClass } from "@/components/category-styles";
import { useSession } from "@/components/session";
import { cn } from "@/lib/utils";

const categoryCopy: Record<PostCategory, { title: string; detail: string }> = {
  rka: {
    title: "RKA",
    detail: "In-depth engineering content connected to Rawkode Academy topics.",
  },
  show: {
    title: "Show",
    detail: "Projects, releases, and demos with practical technical value.",
  },
  ask: {
    title: "Ask",
    detail: "Concrete questions that invite useful, experience-driven replies.",
  },
};

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
  const allowedCategories = sessionQuery.data?.permissions?.allowedCategories ?? postCategories;
  const isAuthReady = !sessionQuery.isLoading;
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/submit";
  }, [location]);

  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const isSubmitting = navigation.state === "submitting";
  const canSubmit = Boolean(title.trim()) && !isSubmitting;

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
      <main className="py-7">
        <section className="rkn-panel p-5">
          <p className="text-sm text-muted-foreground">Checking sign-in…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="py-7">
        <section className="rkn-panel space-y-3 p-5">
          <p className="rkn-kicker">Submit</p>
          <h1 className="rkn-page-title">Sign in to create a post</h1>
          <p className="text-sm text-muted-foreground">
            Posts work best when they include clear context and a concrete reason to discuss.
          </p>
          <div>
            <Button variant="secondary" size="sm" asChild>
              <a href={signInUrl}>Sign in</a>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-5 py-7">
      <header className="space-y-2">
        <p className="rkn-kicker">Submit</p>
        <h1 className="rkn-page-title">Create a post</h1>
        <p className="max-w-[72ch] text-sm text-muted-foreground">
          Share a link or write-up with enough context that an engineer can understand it quickly.
        </p>
      </header>

      <section className="rkn-panel overflow-hidden">
        <Form method="post" className="space-y-6 p-5">
          <fieldset className="space-y-6" disabled={isSubmitting}>
            <div className="space-y-2">
              <label htmlFor="submit-title" className="text-sm font-semibold text-foreground">
                Title
              </label>
              <Input
                id="submit-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A clear, specific title"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">Category</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {allowedCategories.map((item) => {
                  const inputId = `category-${item}`;
                  const isSelected = category === item;
                  return (
                    <div key={item} className="relative">
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
                          "block cursor-pointer rounded-none border border-border bg-card px-3 py-3 text-left",
                          "hover:border-primary/35 hover:bg-accent/60",
                          isSelected &&
                            `border-primary/45 bg-primary/10 ring-2 ring-offset-2 ring-offset-background ${getCategoryRingClass(item)}`
                        )}
                      >
                        <span className="block text-sm font-semibold text-foreground">{categoryCopy[item].title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{categoryCopy[item].detail}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="submit-url" className="text-sm font-semibold text-foreground">
                URL (optional)
              </label>
              <Input
                id="submit-url"
                name="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2 rkn-md-editor" data-color-mode="light">
              <label className="text-sm font-semibold text-foreground">Summary (Markdown)</label>
              <p className="text-xs text-muted-foreground">
                Add the key context, tradeoffs, and why this is worth reading.
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <MDEditor
                  value={notes}
                  onChange={(value) => setNotes(value ?? "")}
                  height={290}
                  preview="edit"
                  visibleDragbar={false}
                  textareaProps={{
                    placeholder: "What should engineers know before opening this?",
                  }}
                  className="rounded-none border border-input bg-white"
                />
                <MarkdownPreview
                  source={notes || "Live preview appears here."}
                  className="rkn-prose min-h-[290px] overflow-y-auto rounded-none border border-input bg-white p-4"
                />
              </div>
              <input type="hidden" name="body" value={notes} />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="rounded-none border border-border bg-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Posting as <span className="font-semibold text-foreground">{user.name || user.email}</span>
                </p>
                <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit}>
                  {isSubmitting ? "Publishing..." : "Publish post"}
                </Button>
              </div>
            </div>
          </fieldset>
        </Form>

        <style>{`
          .rkn-md-editor .w-md-editor {
            background-color: #fff;
            color: var(--foreground);
            border: 1px solid var(--border);
            border-radius: 0;
            box-shadow: none;
          }

          .rkn-md-editor .w-md-editor-toolbar {
            background-color: color-mix(in oklab, var(--muted) 75%, white);
            border-bottom: 1px solid var(--border);
            padding: 0.35rem;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
          }

          .rkn-md-editor .w-md-editor-toolbar li button {
            color: var(--foreground);
            opacity: 0.78;
            border-radius: 0;
          }

          .rkn-md-editor .w-md-editor-toolbar li button:hover {
            background-color: var(--accent);
            opacity: 1;
          }

          .rkn-md-editor .w-md-editor-text-input,
          .rkn-md-editor .w-md-editor-text-pre,
          .rkn-md-editor .wmde-markdown {
            font-family: var(--font-body-family);
            font-size: 0.9rem;
            line-height: 1.58;
            color: var(--foreground);
          }

          .rkn-md-editor .w-md-editor-preview,
          .rkn-md-editor .wmde-markdown,
          .rkn-md-editor .w-md-editor-text-pre {
            background-color: transparent;
          }

          .rkn-md-editor .wmde-markdown pre,
          .rkn-md-editor .wmde-markdown code {
            background-color: var(--muted);
          }

          .rkn-md-editor .wmde-markdown pre {
            border: 1px solid var(--border);
            border-radius: 0;
            padding: 0.75rem;
          }

          .rkn-md-editor .w-md-editor-content {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
        `}</style>
      </section>
    </main>
  );
}
