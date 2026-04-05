<script lang="ts">
  import { actions } from "astro:actions";
  import { buildPageItems, type PageItem } from "@/components/tags/admin/shared";
  import {
    type ApiNewsSource,
    type ApiNewsSourcePreviewItem,
    type NewsSourceType,
  } from "@/domains/news-ingest/contracts";
  import { NEWS_SOURCE_PREVIEW_LIMIT } from "@/domains/news-ingest/input-limits";
  import { getExternalDomainLabel } from "@/shared/urls/domain-label";
  import { formatRelativeTime } from "@/shared/contracts";
  import {
    buttonDestructiveSmClass,
    buttonGhostSmClass,
    buttonPrimarySmClass,
    buttonSecondarySmClass,
    inputClass,
    inlinePrimaryLinkClass,
    selectPrimarySmClass,
  } from "@/shared/ui/classes";

  export let initialSources: ApiNewsSource[] = [];
  export let pageSize = 10;

  let sources = [...initialSources];
  let sourceTypeFilter: NewsSourceType | "all" = "all";
  let page = 1;

  let createType: NewsSourceType = "rss";
  let createName = "";
  let createLocator = "";
  let createPending = false;
  let createError: string | null = null;
  let createPreviewPending = false;
  let createPreview:
    | {
        type: NewsSourceType;
        locator: string;
        name: string;
        items: ApiNewsSourcePreviewItem[];
      }
    | null = null;
  let createPreviewError: string | null = null;

  let editSourceId: string | null = null;
  let editType: NewsSourceType = "rss";
  let editName = "";
  let editLocator = "";
  let editPending = false;
  let editError: string | null = null;
  let editPreviewPending = false;
  let editPreview:
    | {
        type: NewsSourceType;
        locator: string;
        name: string;
        items: ApiNewsSourcePreviewItem[];
      }
    | null = null;
  let editPreviewError: string | null = null;

  let togglePendingId: string | null = null;
  let deletePendingId: string | null = null;
  let notice: { tone: "success" | "error"; message: string } | null = null;

  const getPreviewKey = (type: NewsSourceType, locator: string) => `${type}:${locator.trim().toLowerCase()}`;

  const sortSources = (items: ApiNewsSource[]) =>
    [...items].sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }
      return left.name.localeCompare(right.name);
    });

  const mergeSource = (source: ApiNewsSource) => {
    const next = sources.some((item) => item.id === source.id)
      ? sources.map((item) => (item.id === source.id ? source : item))
      : [...sources, source];
    sources = sortSources(next);
  };

  const removeSource = (sourceId: string) => {
    sources = sortSources(sources.filter((item) => item.id !== sourceId));
  };

  const resetCreateForm = () => {
    createType = "rss";
    createName = "";
    createLocator = "";
    createError = null;
    createPreview = null;
    createPreviewError = null;
  };

  const clearEditState = () => {
    editSourceId = null;
    editType = "rss";
    editName = "";
    editLocator = "";
    editPending = false;
    editError = null;
    editPreviewPending = false;
    editPreview = null;
    editPreviewError = null;
  };

  const openEdit = (source: ApiNewsSource) => {
    if (editSourceId === source.id) {
      clearEditState();
      return;
    }

    editSourceId = source.id;
    editType = source.type;
    editName = source.name;
    editLocator = source.locator;
    editError = null;
    editPreview = null;
    editPreviewError = null;
    notice = null;
  };

  const requestPreview = async (
    source: { type: NewsSourceType; locator: string; name?: string },
  ) => {
    const form = new FormData();
    form.set("type", source.type);
    form.set("locator", source.locator.trim());

    const result = await actions.previewNewsSource(form);
    if (result.error) {
      throw new Error(result.error.message);
    }
    if (!result?.data?.preview) {
      throw new Error("Preview did not return data.");
    }

    return {
      type: source.type,
      locator: result.data.preview.locator,
      name: source.name?.trim() || "Source preview",
      items: result.data.preview.items,
    };
  };

  const loadCreatePreview = async (
    source: { type: NewsSourceType; locator: string; name?: string },
    options: { silent?: boolean } = {},
  ) => {
    if (createPreviewPending) {
      return;
    }

    createPreviewPending = true;
    createPreviewError = null;

    try {
      createPreview = await requestPreview({
        ...source,
        name: source.name?.trim() || createName.trim() || "Source preview",
      });
    } catch (error) {
      createPreview = null;
      createPreviewError = error instanceof Error ? error.message : "Could not load source preview.";
      if (!options.silent) {
        notice = {
          tone: "error",
          message: createPreviewError,
        };
      }
    } finally {
      createPreviewPending = false;
    }
  };

  const loadEditPreview = async (
    source: { type: NewsSourceType; locator: string; name?: string },
    options: { silent?: boolean } = {},
  ) => {
    if (editPreviewPending) {
      return;
    }

    editPreviewPending = true;
    editPreviewError = null;

    try {
      editPreview = await requestPreview({
        ...source,
        name: source.name?.trim() || editName.trim() || "Source preview",
      });
    } catch (error) {
      editPreview = null;
      editPreviewError = error instanceof Error ? error.message : "Could not load source preview.";
      if (!options.silent) {
        notice = {
          tone: "error",
          message: editPreviewError,
        };
      }
    } finally {
      editPreviewPending = false;
    }
  };

  const submitCreateForm = async () => {
    if (createPending) {
      return;
    }

    createPending = true;
    createError = null;
    notice = null;

    try {
      const form = new FormData();
      form.set("type", createType);
      form.set("name", createName.trim());
      form.set("locator", createLocator.trim());
      const result = await actions.createNewsSource(form);

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result?.data?.source) {
        throw new Error("Source creation did not return data.");
      }

      mergeSource(result.data.source);
      notice = {
        tone: "success",
        message: "Source created.",
      };
      await loadCreatePreview(
        {
          type: result.data.source.type,
          locator: result.data.source.locator,
          name: result.data.source.name,
        },
        { silent: true },
      );
      resetCreateForm();
    } catch (error) {
      createError = error instanceof Error ? error.message : "Could not save source.";
    } finally {
      createPending = false;
    }
  };

  const submitEditForm = async () => {
    if (!editSourceId || editPending) {
      return;
    }

    editPending = true;
    editError = null;
    notice = null;

    try {
      const form = new FormData();
      form.set("sourceId", editSourceId);
      form.set("type", editType);
      form.set("name", editName.trim());
      form.set("locator", editLocator.trim());

      const result = await actions.updateNewsSource(form);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data?.source) {
        throw new Error("Source update did not return data.");
      }

      mergeSource(result.data.source);
      clearEditState();
      notice = {
        tone: "success",
        message: "Source updated.",
      };
    } catch (error) {
      editError = error instanceof Error ? error.message : "Could not save source.";
    } finally {
      editPending = false;
    }
  };

  const toggleEnabled = async (source: ApiNewsSource) => {
    if (togglePendingId) {
      return;
    }

    togglePendingId = source.id;
    notice = null;

    try {
      const form = new FormData();
      form.set("sourceId", source.id);
      form.set("enabled", String(!source.enabled));
      const result = await actions.setNewsSourceEnabled(form);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data?.source) {
        throw new Error("Source toggle did not return data.");
      }
      mergeSource(result.data.source);
      notice = {
        tone: "success",
        message: result.data.source.enabled ? "Source enabled." : "Source disabled.",
      };
    } catch (error) {
      notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update source state.",
      };
    } finally {
      togglePendingId = null;
    }
  };

  const deleteSource = async (source: ApiNewsSource) => {
    if (deletePendingId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${source.name}" and remove unpublished pulled news that only came from this source? Published posts will be kept.`,
    );
    if (!confirmed) {
      return;
    }

    deletePendingId = source.id;
    notice = null;

    try {
      const form = new FormData();
      form.set("sourceId", source.id);
      const result = await actions.deleteNewsSource(form);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data) {
        throw new Error("Source delete did not return data.");
      }

      removeSource(source.id);
      if (editSourceId === source.id) {
        clearEditState();
      }

      const removedCount = result.data.removedCandidateCount ?? 0;
      notice = {
        tone: "success",
        message:
          removedCount > 0
            ? `Source deleted. Removed ${removedCount} unpublished ${removedCount === 1 ? "item" : "items"}.`
            : "Source deleted. No unpublished items were removed.",
      };
    } catch (error) {
      notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Could not delete source.",
      };
    } finally {
      deletePendingId = null;
    }
  };

  const sourceTypeLabel = (value: NewsSourceType) => (value === "rss" ? "RSS" : "Bluesky");
  const locatorHint = (type: NewsSourceType) =>
    type === "rss"
      ? "Use the feed URL or a normal site URL. RSS and Atom feeds are auto-detected."
      : "Use a Bluesky handle, DID, or profile URL.";
  const locatorPlaceholder = (type: NewsSourceType) =>
    type === "rss"
      ? "https://example.com/feed.xml"
      : "example.bsky.social";
  const previewStale = (
    previewData: {
      type: NewsSourceType;
      locator: string;
    } | null,
    type: NewsSourceType,
    locator: string,
  ) =>
    Boolean(previewData) &&
    Boolean(locator.trim()) &&
    getPreviewKey(previewData.type, previewData.locator) !== getPreviewKey(type, locator);
  const toPlainPreviewText = (value: string | null) => {
    if (!value) {
      return null;
    }

    const normalized = value
      .replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
      .replace(/`{1,3}([^`]+)`{1,3}/gu, "$1")
      .replace(/^>\s?/gmu, "")
      .replace(/^#{1,6}\s+/gmu, "")
      .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gmu, "")
      .replace(/[*_~]/gu, "")
      .replace(/\r\n?/gu, "\n")
      .replace(/\n+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();

    return normalized || null;
  };
  const clipText = (value: string | null, max = 180, treatAsMarkdown = false) => {
    const normalized = treatAsMarkdown ? toPlainPreviewText(value) : value?.trim() ?? null;
    if (!normalized) {
      return null;
    }
    return normalized.length <= max
      ? normalized
      : `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  };

  $: enabledCount = sources.filter((source) => source.enabled).length;
  $: filteredSources = sourceTypeFilter === "all"
    ? sortSources(sources)
    : sortSources(sources.filter((source) => source.type === sourceTypeFilter));
  $: totalPages = Math.max(1, Math.ceil(filteredSources.length / pageSize));
  $: page = Math.min(page, totalPages);
  $: pageStart = (page - 1) * pageSize;
  $: pagedSources = filteredSources.slice(pageStart, pageStart + pageSize);
  $: pageItems = buildPageItems(page, totalPages);
  $: {
    if (editSourceId && !sources.some((source) => source.id === editSourceId)) {
      clearEditState();
    }
  }
</script>

<div class="space-y-5">
  <section class="rkn-panel overflow-hidden">
    <div class="border-b border-border/75 px-5 py-5">
      <form
        class="grid gap-3 md:grid-cols-[9rem_1fr] lg:grid-cols-[8rem_1fr]"
        on:submit|preventDefault={submitCreateForm}
      >
        <p class="md:col-span-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Add source
        </p>

        <label class="space-y-1">
          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Type</span>
          <select bind:value={createType} class={selectPrimarySmClass}>
            <option value="rss">RSS</option>
            <option value="bluesky">Bluesky</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Name</span>
          <input
            bind:value={createName}
            class={inputClass}
            maxlength={80}
            placeholder="Kubernetes blog"
            required
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Locator</span>
          <input
            bind:value={createLocator}
            class={inputClass}
            placeholder={locatorPlaceholder(createType)}
            required
          />
          <p class="text-xs text-muted-foreground">{locatorHint(createType)}</p>
        </label>

        <div class="md:col-span-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class={buttonSecondarySmClass}
            disabled={createPreviewPending || createPending || !createLocator.trim()}
            on:click={() => loadCreatePreview({ type: createType, locator: createLocator, name: createName })}
          >
            {createPreviewPending ? `Loading latest ${NEWS_SOURCE_PREVIEW_LIMIT}...` : `Preview latest ${NEWS_SOURCE_PREVIEW_LIMIT}`}
          </button>

          <button
            type="submit"
            class={buttonPrimarySmClass}
            disabled={createPending || !createName.trim() || !createLocator.trim()}
          >
            {createPending ? "Saving..." : "Add source"}
          </button>
        </div>

        {#if createError}
          <p role="alert" class="md:col-span-2 text-sm text-destructive">{createError}</p>
        {/if}
      </form>
    </div>

    <div class="border-b border-border/75 bg-muted/14 px-5 py-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Source preview
          </p>
          <p class="max-w-[40rem] text-sm text-muted-foreground">
            Pull the latest {NEWS_SOURCE_PREVIEW_LIMIT} items before saving so you can verify the feed shape and cadence.
          </p>
        </div>

        {#if createPreview && previewStale(createPreview, createType, createLocator)}
          <span class="rounded-none border border-border bg-card px-2 py-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            Preview out of date
          </span>
        {/if}
      </div>

      {#if createPreviewError}
        <p role="alert" class="mt-3 text-sm text-destructive">{createPreviewError}</p>
      {:else if createPreview}
        <div class="mt-4 space-y-3">
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span class="rounded-none border border-border bg-card px-2 py-0.5 tracking-wide uppercase">
              {sourceTypeLabel(createPreview.type)}
            </span>
            <span class="font-medium text-foreground">{createPreview.name}</span>
            <span aria-hidden="true">•</span>
            <span class="font-mono break-all">{createPreview.locator}</span>
          </div>

          {#if createPreview.items.length === 0}
            <p class="text-sm text-muted-foreground">
              No recent items were returned for this source.
            </p>
          {:else}
            <div class="grid gap-3 xl:grid-cols-2">
              {#each createPreview.items as item, index (item.url + index)}
                <article class="border border-border/75 bg-card px-4 py-3">
                  <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{index + 1}</span>
                      <span aria-hidden="true">•</span>
                      <span>{getExternalDomainLabel(item.url) ?? "External link"}</span>
                      {#if item.publishedAt}
                        <span aria-hidden="true">•</span>
                        <span>{formatRelativeTime(item.publishedAt)}</span>
                      {/if}
                    </div>

                    <h3 class="font-display text-base font-semibold leading-snug text-foreground">
                      {item.title}
                    </h3>

                    {#if item.excerpt}
                      <p class="text-sm leading-relaxed text-muted-foreground">
                        {clipText(item.excerpt, 180, createPreview.type === "rss")}
                      </p>
                    {/if}

                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {#if item.authorName}
                        <span>{item.authorName}</span>
                        <span aria-hidden="true">•</span>
                      {/if}
                      <a href={item.url} target="_blank" rel="noreferrer" class={inlinePrimaryLinkClass}>
                        Open item
                      </a>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <p class="mt-3 text-sm text-muted-foreground">
          No preview loaded yet.
        </p>
      {/if}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
      <div class="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>{enabledCount} enabled</span>
        <span aria-hidden="true">•</span>
        <span>{sources.length} total</span>
      </div>

      <label class="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Filter</span>
        <select bind:value={sourceTypeFilter} class={selectPrimarySmClass}>
          <option value="all">All</option>
          <option value="rss">RSS</option>
          <option value="bluesky">Bluesky</option>
        </select>
      </label>
    </div>

    {#if notice}
      <p
        class={`border-y px-5 py-3 text-sm ${
          notice.tone === "error" ? "border-destructive/30 bg-destructive/6 text-destructive" : "border-border/70 bg-muted/20 text-foreground"
        }`}
        role={notice.tone === "error" ? "alert" : "status"}
      >
        {notice.message}
      </p>
    {/if}

    {#if filteredSources.length === 0}
      <div class="px-5 py-8 text-sm text-muted-foreground">
        No sources match the current filter.
      </div>
    {:else}
      <div class="overflow-x-auto border-t border-border/75">
        <table class="min-w-full border-collapse text-sm">
          <thead class="border-b border-border/70 bg-muted/30">
            <tr>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Name</th>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Type</th>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Locator</th>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Last pull</th>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">State</th>
              <th class="px-5 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-border/70">
            {#each pagedSources as source (source.id)}
              <tr class="align-top">
                  <td class="px-5 py-3">
                    <div class="space-y-1">
                      <p class="font-semibold text-foreground">{source.name}</p>
                      <p class="text-xs text-muted-foreground">Added {formatRelativeTime(source.createdAt)}</p>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <span class="rounded-none border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                      {sourceTypeLabel(source.type)}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-mono text-xs text-muted-foreground break-all">{source.locator}</td>
                  <td class="px-5 py-3 text-muted-foreground">
                    {#if source.lastPulledAt}
                      <div class="space-y-1">
                        <p>{formatRelativeTime(source.lastPulledAt)}</p>
                        <p class={source.lastPullStatus === "error" ? "text-destructive" : "text-muted-foreground"}>
                          {source.lastPullMessage ?? `${source.lastPullCount} items checked`}
                        </p>
                      </div>
                    {:else}
                      Never
                    {/if}
                  </td>
                  <td class="px-5 py-3">
                    <span class={`rounded-none border px-2 py-0.5 text-[11px] tracking-wide uppercase ${
                      source.enabled
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {source.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td class="px-5 py-3">
                    <div class="flex flex-wrap items-center gap-2 whitespace-nowrap">
                      <button type="button" class={buttonSecondarySmClass} on:click={() => openEdit(source)}>
                        {editSourceId === source.id ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        class={buttonGhostSmClass}
                        disabled={togglePendingId === source.id || deletePendingId === source.id}
                        on:click={() => toggleEnabled(source)}
                      >
                        {togglePendingId === source.id
                          ? source.enabled ? "Disabling..." : "Enabling..."
                          : source.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        class={buttonDestructiveSmClass}
                        disabled={deletePendingId === source.id || togglePendingId === source.id}
                        on:click={() => deleteSource(source)}
                      >
                        {deletePendingId === source.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>

              {#if editSourceId === source.id}
                <tr class="bg-muted/12">
                  <td colspan="6" class="px-5 py-4">
                    <div class="space-y-4">
                      <form
                        class="grid gap-3 md:grid-cols-[9rem_1fr] lg:grid-cols-[8rem_1fr]"
                        on:submit|preventDefault={submitEditForm}
                      >
                        <p class="md:col-span-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Edit source
                        </p>

                        <label class="space-y-1">
                          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Type</span>
                          <select bind:value={editType} class={selectPrimarySmClass}>
                            <option value="rss">RSS</option>
                            <option value="bluesky">Bluesky</option>
                          </select>
                        </label>

                        <label class="space-y-1">
                          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Name</span>
                          <input
                            bind:value={editName}
                            class={inputClass}
                            maxlength={80}
                            required
                          />
                        </label>

                        <label class="space-y-1 md:col-span-2">
                          <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Locator</span>
                          <input
                            bind:value={editLocator}
                            class={inputClass}
                            placeholder={locatorPlaceholder(editType)}
                            required
                          />
                          <p class="text-xs text-muted-foreground">{locatorHint(editType)}</p>
                        </label>

                        <div class="md:col-span-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            class={buttonSecondarySmClass}
                            disabled={editPreviewPending || editPending || !editLocator.trim()}
                            on:click={() => loadEditPreview({ type: editType, locator: editLocator, name: editName })}
                          >
                            {editPreviewPending ? `Loading latest ${NEWS_SOURCE_PREVIEW_LIMIT}...` : `Preview latest ${NEWS_SOURCE_PREVIEW_LIMIT}`}
                          </button>

                          <button
                            type="submit"
                            class={buttonPrimarySmClass}
                            disabled={editPending || !editName.trim() || !editLocator.trim()}
                          >
                            {editPending ? "Saving..." : "Save source"}
                          </button>

                          <button type="button" class={buttonSecondarySmClass} on:click={clearEditState}>
                            Cancel
                          </button>
                        </div>

                        {#if editError}
                          <p role="alert" class="md:col-span-2 text-sm text-destructive">{editError}</p>
                        {/if}
                      </form>

                      <div class="border border-border/75 bg-card/70 px-4 py-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="space-y-1">
                            <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              Preview
                            </p>
                            <p class="text-sm text-muted-foreground">
                              Check the latest {NEWS_SOURCE_PREVIEW_LIMIT} items before saving changes.
                            </p>
                          </div>

                          {#if editPreview && previewStale(editPreview, editType, editLocator)}
                            <span class="rounded-none border border-border bg-card px-2 py-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                              Preview out of date
                            </span>
                          {/if}
                        </div>

                        {#if editPreviewError}
                          <p role="alert" class="mt-3 text-sm text-destructive">{editPreviewError}</p>
                        {:else if editPreview}
                          <div class="mt-4 space-y-3">
                            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span class="rounded-none border border-border bg-card px-2 py-0.5 tracking-wide uppercase">
                                {sourceTypeLabel(editPreview.type)}
                              </span>
                              <span class="font-medium text-foreground">{editPreview.name}</span>
                              <span aria-hidden="true">•</span>
                              <span class="font-mono break-all">{editPreview.locator}</span>
                            </div>

                            {#if editPreview.items.length === 0}
                              <p class="text-sm text-muted-foreground">
                                No recent items were returned for this source.
                              </p>
                            {:else}
                              <div class="grid gap-3 xl:grid-cols-2">
                                {#each editPreview.items as item, index (item.url + index)}
                                  <article class="border border-border/75 bg-card px-4 py-3">
                                    <div class="space-y-2">
                                      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>{index + 1}</span>
                                        <span aria-hidden="true">•</span>
                                        <span>{getExternalDomainLabel(item.url) ?? "External link"}</span>
                                        {#if item.publishedAt}
                                          <span aria-hidden="true">•</span>
                                          <span>{formatRelativeTime(item.publishedAt)}</span>
                                        {/if}
                                      </div>

                                      <h3 class="font-display text-base font-semibold leading-snug text-foreground">
                                        {item.title}
                                      </h3>

                                      {#if item.excerpt}
                                        <p class="text-sm leading-relaxed text-muted-foreground">
                                          {clipText(item.excerpt, 180, editPreview.type === "rss")}
                                        </p>
                                      {/if}

                                      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        {#if item.authorName}
                                          <span>{item.authorName}</span>
                                          <span aria-hidden="true">•</span>
                                        {/if}
                                        <a href={item.url} target="_blank" rel="noreferrer" class={inlinePrimaryLinkClass}>
                                          Open item
                                        </a>
                                      </div>
                                    </div>
                                  </article>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {:else}
                          <p class="mt-3 text-sm text-muted-foreground">
                            No preview loaded yet.
                          </p>
                        {/if}
                      </div>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>

      {#if totalPages > 1}
        <nav
          aria-label="Source pagination"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-border/75 px-5 py-3 text-xs text-muted-foreground"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            {#if page <= 1}
              <span class="inline-flex h-9 items-center rounded-none px-3 text-[0.83rem] font-semibold text-muted-foreground">Previous</span>
            {:else}
              <button type="button" class={buttonGhostSmClass} on:click={() => (page = page - 1)}>
                Previous
              </button>
            {/if}

            {#each pageItems as item}
              {#if typeof item !== "number"}
                <span aria-hidden="true" class="px-1 text-muted-foreground/75">…</span>
              {:else if item === page}
                <span aria-current="page" class="inline-flex h-9 items-center rounded-none bg-secondary px-3 text-[0.83rem] font-semibold text-foreground">
                  {item}
                </span>
              {:else}
                <button type="button" class={buttonGhostSmClass} on:click={() => (page = item)}>
                  {item}
                </button>
              {/if}
            {/each}

            {#if page >= totalPages}
              <span class="inline-flex h-9 items-center rounded-none px-3 text-[0.83rem] font-semibold text-muted-foreground">Next</span>
            {:else}
              <button type="button" class={buttonGhostSmClass} on:click={() => (page = page + 1)}>
                Next
              </button>
            {/if}
          </div>

          <span>Page {page} of {totalPages}</span>
        </nav>
      {/if}
    {/if}
  </section>
</div>
