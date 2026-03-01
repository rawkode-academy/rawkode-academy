<script lang="ts">
  import { actions } from "astro:actions";
  import { onMount } from "svelte";
  import type { ApiTag } from "@/lib/contracts";
  import { deriveTagSlug } from "@/lib/tags";
  import CreateTagForm from "@/components/admin/tags/CreateTagForm.svelte";
  import TagsTable from "@/components/admin/tags/TagsTable.svelte";
  import DeleteTagDialog from "@/components/admin/tags/DeleteTagDialog.svelte";
  import {
    buildPageItems,
    normalizeSlug,
    parsePageValue,
    rowAnchor,
    sortTags,
    toEditState,
    type EditState,
    type PageItem,
  } from "@/components/admin/tags/shared";

  export let initialTags: ApiTag[] = [];
  export let initialPage = 1;
  export let initialEditSlug: string | null = null;
  export let initialConfirmSlug: string | null = null;
  export let pageSize = 10;

  let tags: ApiTag[] = [];
  let page = Math.max(1, initialPage);
  let editSlug = initialEditSlug;
  let confirmSlug = initialConfirmSlug;

  let createName = "";
  let createSlug = "";
  let createSlugManuallyEdited = false;
  let createDescription = "";
  let createError: string | null = null;

  let editing: EditState | null = null;
  let editError: string | null = null;
  let deleteError: string | null = null;
  let confirmTag: ApiTag | null = null;
  let blockedConfirmTag: ApiTag | null = null;

  let createPending = false;
  let updatePending = false;
  let deletePending = false;

  let mounted = false;
  let totalPages = 1;
  let currentPage = 1;
  let pageStartIndex = 0;
  let pagedTags: ApiTag[] = [];
  let pageItems: PageItem[] = [];

  const getAsyncErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "You appear to be offline. Reconnect and try again.";
    }
    return fallback;
  };

  const readLocationState = () => {
    if (typeof window === "undefined") {
      return {
        page,
        editSlug: normalizeSlug(editSlug),
        confirmSlug: normalizeSlug(confirmSlug),
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      page: parsePageValue(params.get("page")),
      editSlug: normalizeSlug(params.get("edit")),
      confirmSlug: normalizeSlug(params.get("confirm")),
    };
  };

  const writeLocationState = (
    next: { page: number; editSlug: string | null; confirmSlug: string | null },
    options: { replace?: boolean; hash?: string | null } = {},
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (next.page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next.page));
    }

    if (next.editSlug) {
      params.set("edit", next.editSlug);
    } else {
      params.delete("edit");
    }

    if (next.confirmSlug) {
      params.set("confirm", next.confirmSlug);
    } else {
      params.delete("confirm");
    }

    const search = params.toString();
    const hash = options.hash ? `#${encodeURIComponent(options.hash)}` : "";
    const nextHref = `${window.location.pathname}${search ? `?${search}` : ""}${hash}`;

    if (options.replace) {
      history.replaceState(history.state, "", nextHref);
    } else {
      history.pushState(history.state, "", nextHref);
    }
  };

  const syncLocation = (options: { replace?: boolean; hash?: string | null } = {}) => {
    if (!mounted) {
      return;
    }

    writeLocationState(
      {
        page,
        editSlug: normalizeSlug(editSlug),
        confirmSlug: normalizeSlug(confirmSlug),
      },
      options,
    );
  };

  const scrollToAnchor = (anchor: string | null) => {
    if (!anchor) {
      return;
    }

    requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      if (!target) {
        return;
      }
      target.scrollIntoView({ block: "center" });
    });
  };

  const syncFromLocation = () => {
    const state = readLocationState();
    page = state.page;
    editSlug = state.editSlug;
    confirmSlug = state.confirmSlug;
  };

  const setPage = (nextPage: number) => {
    page = Math.max(1, nextPage);
    syncLocation({ replace: false });
  };

  const openEdit = (tag: ApiTag) => {
    if (tag.kind === "mandatory") {
      return;
    }

    editSlug = tag.slug;
    confirmSlug = null;
    editError = null;
    syncLocation({ hash: rowAnchor(tag.id) });
    scrollToAnchor(rowAnchor(tag.id));
  };

  const cancelEdit = (tagId: string) => {
    editSlug = null;
    editing = null;
    editError = null;
    syncLocation({ hash: rowAnchor(tagId) });
    scrollToAnchor(rowAnchor(tagId));
  };

  const openConfirm = (tag: ApiTag) => {
    confirmSlug = tag.slug;
    editSlug = null;
    deleteError = null;
    syncLocation({ hash: rowAnchor(tag.id) });
    scrollToAnchor(rowAnchor(tag.id));
  };

  const closeConfirm = (tagId?: string | null) => {
    confirmSlug = null;
    deleteError = null;
    syncLocation({ hash: tagId ? rowAnchor(tagId) : null });
    if (tagId) {
      scrollToAnchor(rowAnchor(tagId));
    }
  };

  const handleCreateNameInput = (value: string) => {
    createName = value;
    if (!createSlugManuallyEdited) {
      createSlug = deriveTagSlug(value);
    }
  };

  const handleCreateSlugInput = (value: string) => {
    createSlug = value;
    createSlugManuallyEdited = true;
  };

  const handleCreateDescriptionInput = (value: string) => {
    createDescription = value;
  };

  const handleEditNameInput = (value: string) => {
    if (!editing) {
      return;
    }

    editing = {
      ...editing,
      name: value,
      slug: editing.slugManuallyEdited ? editing.slug : deriveTagSlug(value),
    };
  };

  const handleEditSlugInput = (value: string) => {
    if (!editing) {
      return;
    }

    editing = {
      ...editing,
      slug: value,
      slugManuallyEdited: true,
    };
  };

  const handleEditDescriptionInput = (value: string) => {
    if (!editing) {
      return;
    }

    editing = {
      ...editing,
      description: value,
    };
  };

  const createTag = async () => {
    if (!createName.trim() || createPending) {
      return;
    }

    createPending = true;
    createError = null;

    try {
      const form = new FormData();
      form.set("name", createName.trim());
      if (createSlug.trim()) {
        form.set("slug", createSlug.trim());
      }
      if (createDescription.trim()) {
        form.set("description", createDescription.trim());
      }

      const result = await actions.createTag(form);
      if (result.error) {
        createError = result.error.message;
        return;
      }

      const created = result.data?.tag;
      if (!created) {
        createError = "Tag was created but no data was returned.";
        return;
      }

      tags = sortTags([...tags, created]);
      createName = "";
      createSlug = "";
      createDescription = "";
      createSlugManuallyEdited = false;

      const createdIndex = tags.findIndex((tag) => tag.id === created.id);
      if (createdIndex >= 0) {
        page = Math.floor(createdIndex / pageSize) + 1;
      }

      editSlug = null;
      confirmSlug = null;
      syncLocation({ hash: rowAnchor(created.id) });
      scrollToAnchor(rowAnchor(created.id));
    } catch (error) {
      createError = getAsyncErrorMessage(
        error,
        "Could not create tag right now. Please try again.",
      );
    } finally {
      createPending = false;
    }
  };

  const saveEdit = async () => {
    if (!editing || updatePending || !editing.name.trim()) {
      return;
    }

    updatePending = true;
    editError = null;

    try {
      const form = new FormData();
      form.set("originalSlug", editing.originalSlug);
      form.set("name", editing.name.trim());
      if (editing.slug.trim()) {
        form.set("slug", editing.slug.trim());
      }
      if (editing.description.trim()) {
        form.set("description", editing.description.trim());
      }

      const result = await actions.updateTag(form);
      if (result.error) {
        editError = result.error.message;
        return;
      }

      const updated = result.data?.tag;
      if (!updated) {
        editError = "Tag was updated but no data was returned.";
        return;
      }

      tags = sortTags(tags.map((tag) => (tag.id === updated.id ? updated : tag)));
      editSlug = null;
      editing = null;
      syncLocation({ hash: rowAnchor(updated.id) });
      scrollToAnchor(rowAnchor(updated.id));
    } catch (error) {
      editError = getAsyncErrorMessage(
        error,
        "Could not save tag changes right now. Please try again.",
      );
    } finally {
      updatePending = false;
    }
  };

  const deleteTag = async (target: ApiTag) => {
    if (deletePending) {
      return;
    }

    deletePending = true;
    deleteError = null;

    try {
      const form = new FormData();
      form.set("slug", target.slug);

      const result = await actions.deleteTag(form);
      if (result.error) {
        deleteError = result.error.message;
        return;
      }

      const previousIndex = tags.findIndex((tag) => tag.id === target.id);
      const nextTags = tags.filter((tag) => tag.slug !== target.slug);
      tags = sortTags(nextTags);
      confirmSlug = null;
      if (editSlug === target.slug) {
        editSlug = null;
      }

      if (tags.length === 0) {
        page = 1;
        syncLocation({ hash: null });
        return;
      }

      const fallback = tags[Math.min(previousIndex, tags.length - 1)] ?? tags[0];
      const fallbackIndex = tags.findIndex((tag) => tag.id === fallback.id);
      if (fallbackIndex >= 0) {
        page = Math.floor(fallbackIndex / pageSize) + 1;
      }

      syncLocation({ hash: rowAnchor(fallback.id) });
      scrollToAnchor(rowAnchor(fallback.id));
    } catch (error) {
      deleteError = getAsyncErrorMessage(
        error,
        "Could not delete tag right now. Please try again.",
      );
    } finally {
      deletePending = false;
    }
  };

  $: totalPages = Math.max(1, Math.ceil(tags.length / pageSize));
  $: currentPage = Math.min(Math.max(page, 1), totalPages);
  $: pageStartIndex = (currentPage - 1) * pageSize;
  $: pagedTags = tags.slice(pageStartIndex, pageStartIndex + pageSize);
  $: pageItems = buildPageItems(currentPage, totalPages);

  $: {
    const normalized = normalizeSlug(editSlug);
    const target = normalized
      ? tags.find((tag) => tag.slug === normalized && tag.kind === "optional")
      : null;

    if (!target) {
      if (editing) {
        editing = null;
      }
    } else if (!editing || editing.id !== target.id) {
      editing = toEditState(target);
    }
  }

  $: confirmTag = confirmSlug
    ? tags.find((tag) => tag.slug === normalizeSlug(confirmSlug) && tag.kind === "optional" && (tag.usageCount ?? 0) === 0) ?? null
    : null;

  $: blockedConfirmTag = confirmSlug
    ? tags.find((tag) => tag.slug === normalizeSlug(confirmSlug) && tag.kind === "optional" && (tag.usageCount ?? 0) > 0) ?? null
    : null;

  onMount(() => {
    tags = sortTags(initialTags);
    syncFromLocation();
    mounted = true;

    const onPopState = () => {
      syncFromLocation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && confirmSlug && !deletePending) {
        const id = confirmTag?.id ?? blockedConfirmTag?.id ?? null;
        closeConfirm(id);
      }
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);

    if (window.location.hash.length > 1) {
      const id = decodeURIComponent(window.location.hash.slice(1));
      scrollToAnchor(id);
    }

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

<CreateTagForm
  {createName}
  {createSlug}
  {createDescription}
  {createError}
  {createPending}
  onNameInput={handleCreateNameInput}
  onSlugInput={handleCreateSlugInput}
  onDescriptionInput={handleCreateDescriptionInput}
  onCreate={createTag}
/>

<TagsTable
  {tags}
  {pagedTags}
  {editing}
  {editError}
  {updatePending}
  {deleteError}
  {blockedConfirmTag}
  {currentPage}
  {totalPages}
  {pageItems}
  onEditNameInput={handleEditNameInput}
  onEditSlugInput={handleEditSlugInput}
  onEditDescriptionInput={handleEditDescriptionInput}
  onSaveEdit={saveEdit}
  onCancelEdit={cancelEdit}
  onOpenEdit={openEdit}
  onOpenConfirm={openConfirm}
  onSetPage={setPage}
/>

<DeleteTagDialog
  {confirmTag}
  {deletePending}
  onCancel={closeConfirm}
  onConfirm={(tag) => {
    void deleteTag(tag);
  }}
/>
