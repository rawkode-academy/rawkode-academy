import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { ApiTag } from "@/components/app-data";
import { PaginationControls } from "@/components/pagination-controls";
import { parsePage, tagsQueryOptions } from "@/components/query-client";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deriveTagSlug } from "@/lib/tags";

type EditState = {
  id: string;
  originalSlug: string;
  name: string;
  slug: string;
  description: string;
  slugManuallyEdited: boolean;
};

const mandatoryDisplayNames: Record<string, string> = {
  rka: "RKA",
  news: "News",
  show: "Show",
  ask: "Ask",
};
const TAGS_PAGE_SIZE = 10;

const sortTags = (items: ApiTag[]) =>
  [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "mandatory" ? -1 : 1;
    }
    return left.slug.localeCompare(right.slug);
  });

const normalizeError = async (response: Response) => {
  const text = await response.text();
  return text || "Request failed";
};

const getTagDisplayName = (tag: ApiTag) =>
  tag.kind === "mandatory"
    ? mandatoryDisplayNames[tag.slug] ?? tag.name ?? tag.slug
    : tag.name || tag.slug;

type DeleteDialogState = {
  slug: string;
  label: string;
};

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const sessionQuery = useSession();
  const tagsQuery = useQuery(tagsQueryOptions());
  const [createName, setCreateName] = React.useState("");
  const [createSlug, setCreateSlug] = React.useState("");
  const [createSlugManuallyEdited, setCreateSlugManuallyEdited] = React.useState(false);
  const [createDescription, setCreateDescription] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<EditState | null>(null);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState | null>(null);

  const isAdmin = Boolean(sessionQuery.data?.permissions?.isAdmin);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          slug: createSlug,
          description: createDescription || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await normalizeError(response));
      }

      return (await response.json()) as ApiTag;
    },
    onSuccess: () => {
      setCreateName("");
      setCreateSlug("");
      setCreateSlugManuallyEdited(false);
      setCreateDescription("");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : String(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: EditState) => {
      const response = await fetch(`/api/tags/${encodeURIComponent(payload.originalSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        }),
      });

      if (!response.ok) {
        throw new Error(await normalizeError(response));
      }

      return (await response.json()) as ApiTag;
    },
    onSuccess: () => {
      setEditError(null);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      setEditError(error instanceof Error ? error.message : String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const response = await fetch(`/api/tags/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await normalizeError(response));
      }
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      setDeleteError(error instanceof Error ? error.message : String(error));
    },
  });

  const tags = sortTags(tagsQuery.data ?? []);
  const page = parsePage(searchParams.get("page"));
  const totalPages = Math.max(1, Math.ceil(tags.length / TAGS_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageStartIndex = (clampedPage - 1) * TAGS_PAGE_SIZE;
  const pagedTags = tags.slice(pageStartIndex, pageStartIndex + TAGS_PAGE_SIZE);

  const handleCreateNameChange = React.useCallback(
    (value: string) => {
      setCreateName(value);
      if (!createSlugManuallyEdited) {
        setCreateSlug(deriveTagSlug(value));
      }
    },
    [createSlugManuallyEdited],
  );

  const handleCreateSlugChange = React.useCallback((value: string) => {
    setCreateSlug(value);
    setCreateSlugManuallyEdited(true);
  }, []);

  React.useEffect(() => {
    if (page === clampedPage) return;
    const next = new URLSearchParams(searchParamsKey);
    if (clampedPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(clampedPage));
    }
    setSearchParams(next, { replace: true });
  }, [clampedPage, page, searchParamsKey, setSearchParams]);

  React.useEffect(() => {
    if (!deleteDialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteMutation.isPending) {
        setDeleteDialog(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteDialog, deleteMutation.isPending]);

  if (sessionQuery.isLoading || tagsQuery.isLoading) {
    return (
      <main className="py-7">
        <section className="rkn-panel p-5 text-sm text-muted-foreground">Loading tags…</section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="py-7">
        <section className="rkn-panel p-5 text-sm text-muted-foreground">Admin role required.</section>
      </main>
    );
  }

  return (
    <main className="space-y-5 py-7">
      <header className="space-y-2">
        <p className="rkn-kicker">Admin</p>
        <h1 className="rkn-page-title">Manage tags</h1>
        <p className="text-sm text-muted-foreground">
          Core tags are immutable. Optional tags can be created, edited, and deleted when unused.
        </p>
      </header>

      <section className="rkn-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-foreground">Create optional tag</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="create-tag-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name
            </label>
            <Input
              id="create-tag-name"
              value={createName}
              onChange={(event) => handleCreateNameChange(event.target.value)}
              placeholder="Kubernetes"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="create-tag-slug" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Slug
            </label>
            <Input
              id="create-tag-slug"
              value={createSlug}
              onChange={(event) => handleCreateSlugChange(event.target.value)}
              placeholder="kubernetes"
            />
            <p className="text-xs text-muted-foreground">Derived from name by default. You can edit it.</p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="create-tag-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description (optional)
          </label>
          <Input
            id="create-tag-description"
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
            placeholder="Topics about Kubernetes and cluster operations"
          />
        </div>

        {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

        <Button
          type="button"
          disabled={createMutation.isPending || !createName.trim() || !createSlug.trim()}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating..." : "Create tag"}
        </Button>
      </section>

      <section className="rkn-panel overflow-hidden">
        <header className="border-b border-border/70 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground">{tags.length} total tags</p>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="border-b border-border/70 bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kind</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posts</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {pagedTags.map((tag) => {
                const isEditing = editing?.id === tag.id;
                const isCore = tag.kind === "mandatory";
                const canDelete = !isCore && (tag.usageCount ?? 0) === 0;

                if (isEditing) {
                  return (
                    <tr key={tag.id} className="align-top">
                      <td className="px-5 py-3">
                        <Input
                          value={editing.name}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? {
                                    ...current,
                                    name: event.target.value,
                                    slug: current.slugManuallyEdited
                                      ? current.slug
                                      : deriveTagSlug(event.target.value),
                                  }
                                : current,
                            )
                          }
                          placeholder="Tag name"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <Input
                          value={editing.slug}
                          onChange={(event) =>
                            setEditing((current) =>
                              current
                                ? {
                                    ...current,
                                    slug: event.target.value,
                                    slugManuallyEdited: true,
                                  }
                                : current,
                            )
                          }
                          placeholder="tag-slug"
                        />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{tag.kind}</td>
                      <td className="px-5 py-3 text-muted-foreground">{tag.usageCount ?? 0}</td>
                      <td className="px-5 py-3 min-w-[260px]">
                        <Input
                          value={editing.description}
                          onChange={(event) =>
                            setEditing((current) =>
                              current ? { ...current, description: event.target.value } : current,
                            )
                          }
                          placeholder="Optional description"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Button
                            type="button"
                            size="sm"
                            disabled={updateMutation.isPending || !editing.name.trim() || !editing.slug.trim()}
                            onClick={() => updateMutation.mutate(editing)}
                          >
                            {updateMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(null);
                              setEditError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        {editError ? <p className="mt-2 text-sm text-destructive">{editError}</p> : null}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={tag.id} className="align-top">
                    <td className="px-5 py-3 font-semibold text-foreground">{getTagDisplayName(tag)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{tag.slug}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-none border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {tag.kind}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{tag.usageCount ?? 0}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {tag.description || "No description."}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {!isCore ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing({
                                id: tag.id,
                                originalSlug: tag.slug,
                                name: tag.name,
                                slug: tag.slug,
                                description: tag.description ?? "",
                                slugManuallyEdited: false,
                              });
                              setEditError(null);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {!isCore ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!canDelete || deleteMutation.isPending}
                            onClick={() =>
                              setDeleteDialog({
                                slug: tag.slug,
                                label: `${getTagDisplayName(tag)} (${tag.slug})`,
                              })}
                          >
                            Delete
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Core tag is immutable.</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 pb-3">
          <PaginationControls
            page={clampedPage}
            totalPages={totalPages}
            hasMore={clampedPage < totalPages}
            isLoading={Boolean(tagsQuery.isLoading)}
            searchParams={searchParams}
          />
        </div>

        {deleteError ? <p className="px-5 py-4 text-sm text-destructive">{deleteError}</p> : null}
      </section>

      {deleteDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-tag-dialog-title"
            className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-xl"
          >
            <h2 id="delete-tag-dialog-title" className="text-base font-semibold text-foreground">
              Delete tag?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will delete <span className="font-medium text-foreground">{deleteDialog.label}</span>. This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteDialog.slug);
                  setDeleteDialog(null);
                }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete tag"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
