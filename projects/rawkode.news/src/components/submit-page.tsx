import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import MDEditor from "@uiw/react-md-editor/nohighlight";
import MarkdownPreview from "@uiw/react-markdown-preview/nohighlight";
import { Form, useActionData, useLocation, useNavigation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  mandatoryTagSlugs,
  type ApiTag,
  type MandatoryTagSlug,
} from "@/components/app-data";
import { tagsQueryOptions } from "@/components/query-client";
import { useSession } from "@/components/session";
import { MAX_OPTIONAL_TAGS } from "@/lib/tags";

const MOBILE_TAG_GRID_COLUMNS = 4;
const DESKTOP_TAG_GRID_COLUMNS = 8;
const RESERVED_FILTER_COLUMN_COUNT = 1;
const MOBILE_TAGS_PER_ROW = MOBILE_TAG_GRID_COLUMNS - RESERVED_FILTER_COLUMN_COUNT;
const DESKTOP_TAGS_PER_ROW = DESKTOP_TAG_GRID_COLUMNS - RESERVED_FILTER_COLUMN_COUNT;

const pillBaseClass =
  "inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed";
const pillSelectClass =
  "h-9 w-full min-w-0 cursor-pointer rounded-md border border-primary/40 bg-primary/10 px-2 pr-7 text-xs font-semibold text-foreground appearance-none hover:bg-primary/15";

const mandatoryCopy: Record<MandatoryTagSlug, { title: string; detail: string }> = {
  news: {
    title: "News",
    detail: "Relevant news and updates from across the broader ecosystem.",
  },
  rka: {
    title: "RKA",
    detail: "In-depth engineering content connected to Rawkode Academy topics.",
  },
  show: {
    title: "Show",
    detail: "Share something of your own: a project, release, or demo.",
  },
  ask: {
    title: "Ask",
    detail: "Concrete questions that invite useful, experience-driven replies.",
  },
};

type OptionalTagLayout = {
  rows: ApiTag[][];
  canExpand: boolean;
  hiddenTagCount: number;
};

export default function SubmitPage() {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [mandatoryTag, setMandatoryTag] = React.useState<MandatoryTagSlug>("news");
  const [optionalTags, setOptionalTags] = React.useState<string[]>([]);
  const [showMore, setShowMore] = React.useState(false);
  const location = useLocation();
  const navigation = useNavigation();
  const actionData = useActionData() as { error?: string } | undefined;
  const error = actionData?.error ?? null;
  const sessionQuery = useSession();
  const tagsQuery = useQuery(tagsQueryOptions());
  const user = sessionQuery.data?.user ?? null;
  const allowedMandatoryTags =
    sessionQuery.data?.permissions?.allowedMandatoryTags ?? mandatoryTagSlugs;
  const isAuthReady = !sessionQuery.isLoading;
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/submit";
  }, [location]);

  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const isSubmitting = navigation.state === "submitting";
  const canSubmit = Boolean(title.trim()) && !isSubmitting;

  const optionalTagOptions = React.useMemo(
    () => (tagsQuery.data ?? []).filter((tag) => tag.kind === "optional"),
    [tagsQuery.data],
  );
  const optionalTagSet = React.useMemo(
    () => new Set(optionalTags),
    [optionalTags],
  );
  const buildOptionalTagLayout = React.useCallback((tagsPerRow: number): OptionalTagLayout => {
    const tagSlotsWithoutShowAll = tagsPerRow;
    const tagSlotsWithShowAll = Math.max(1, tagsPerRow - 1);
    const canExpand = optionalTagOptions.length > tagSlotsWithoutShowAll;
    const collapsedVisibleTagCount = canExpand ? tagSlotsWithShowAll : tagSlotsWithoutShowAll;
    const hiddenTagCount = Math.max(0, optionalTagOptions.length - collapsedVisibleTagCount);
    const visibleOptionalTags = showMore
      ? optionalTagOptions
      : optionalTagOptions.slice(0, collapsedVisibleTagCount);
    const rows: ApiTag[][] = [];
    for (let index = 0; index < visibleOptionalTags.length; index += tagsPerRow) {
      rows.push(visibleOptionalTags.slice(index, index + tagsPerRow));
    }

    return {
      rows: rows.length > 0 ? rows : [[]],
      canExpand,
      hiddenTagCount,
    };
  }, [optionalTagOptions, showMore]);
  const mobileTagLayout = React.useMemo(
    () => buildOptionalTagLayout(MOBILE_TAGS_PER_ROW),
    [buildOptionalTagLayout],
  );
  const desktopTagLayout = React.useMemo(
    () => buildOptionalTagLayout(DESKTOP_TAGS_PER_ROW),
    [buildOptionalTagLayout],
  );
  const canExpand = mobileTagLayout.canExpand || desktopTagLayout.canExpand;

  const submittedTags = React.useMemo(
    () => JSON.stringify([mandatoryTag, ...optionalTags]),
    [mandatoryTag, optionalTags],
  );

  React.useEffect(() => {
    void import("@uiw/react-md-editor/markdown-editor.css");
    void import("@uiw/react-markdown-preview/markdown.css");
  }, []);

  React.useEffect(() => {
    if (!allowedMandatoryTags.includes(mandatoryTag)) {
      setMandatoryTag(allowedMandatoryTags[0] ?? "news");
    }
  }, [allowedMandatoryTags, mandatoryTag]);

  React.useEffect(() => {
    if (!canExpand && showMore) {
      setShowMore(false);
    }
  }, [canExpand, showMore]);

  const toggleOptionalTag = React.useCallback(
    (slug: string) => {
      setOptionalTags((current) => {
        if (current.includes(slug)) {
          return current.filter((item) => item !== slug);
        }

        if (current.length >= MAX_OPTIONAL_TAGS) {
          return current;
        }

        return [...current, slug];
      });
    },
    [],
  );
  const renderOptionalTagRows = React.useCallback(
    (
      rows: ApiTag[][],
      keyPrefix: string,
      gridColumnsClass: string,
      hiddenTagCount: number,
      canExpandForLayout: boolean,
    ) =>
      rows.map((row, rowIndex) => (
        <div key={`${keyPrefix}-submit-tag-row-${rowIndex}`} className={`grid ${gridColumnsClass} gap-2`}>
          {rowIndex === 0 ? (
            <label className="relative block">
              <span className="sr-only">Mandatory tag</span>
              <select
                id={`${keyPrefix}-submit-mandatory-tag`}
                aria-label="Mandatory tag"
                value={mandatoryTag}
                onChange={(event) => setMandatoryTag(event.target.value as MandatoryTagSlug)}
                className={pillSelectClass}
              >
                {allowedMandatoryTags.map((slug) => (
                  <option key={slug} value={slug}>
                    {mandatoryCopy[slug].title}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-foreground/70"
              >
                ▾
              </span>
            </label>
          ) : (
            <span aria-hidden="true" className="h-9" />
          )}

          {row.map((tag) => {
            const selected = optionalTagSet.has(tag.slug);
            const disableAdd = !selected && optionalTags.length >= MAX_OPTIONAL_TAGS;

            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleOptionalTag(tag.slug)}
                disabled={disableAdd}
                title={
                  disableAdd
                    ? `You can select up to ${MAX_OPTIONAL_TAGS} optional tags`
                    : selected
                      ? `Remove ${tag.slug}`
                      : tag.description ?? undefined
                }
                className={
                  selected
                    ? `${pillBaseClass} border-primary/40 bg-primary/10 text-foreground`
                    : `${pillBaseClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50`
                }
              >
                <span className="min-w-0 truncate">{tag.name || tag.slug}</span>
              </button>
            );
          })}

          {rowIndex === 0 && canExpandForLayout && !showMore ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className={`${pillBaseClass} border-border bg-card text-foreground hover:bg-muted`}
            >
              <span className="min-w-0 truncate">{`Show all (${hiddenTagCount})`}</span>
            </button>
          ) : null}
        </div>
      )),
    [allowedMandatoryTags, mandatoryTag, optionalTagSet, optionalTags.length, showMore, toggleOptionalTag],
  );

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

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Tags</label>
              <div className="space-y-2 sm:hidden">
                {renderOptionalTagRows(
                  mobileTagLayout.rows,
                  "mobile",
                  "grid-cols-4",
                  mobileTagLayout.hiddenTagCount,
                  mobileTagLayout.canExpand,
                )}
              </div>
              <div className="hidden space-y-2 sm:block">
                {renderOptionalTagRows(
                  desktopTagLayout.rows,
                  "desktop",
                  "grid-cols-8",
                  desktopTagLayout.hiddenTagCount,
                  desktopTagLayout.canExpand,
                )}
              </div>

              {optionalTags.length >= MAX_OPTIONAL_TAGS ? (
                <p className="text-xs text-muted-foreground">
                  You can select up to {MAX_OPTIONAL_TAGS} optional tags.
                </p>
              ) : null}
            </div>

            <input type="hidden" name="tags" value={submittedTags} />

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
          }
        `}</style>
      </section>
    </main>
  );
}
