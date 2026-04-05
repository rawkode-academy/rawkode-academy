<script lang="ts">
  import { actions } from "astro:actions";
  import { buildPageItems } from "@/components/tags/admin/shared";
  import {
    type ApiNewsCandidate,
    type ApiNewsSource,
    type NewsCandidateStatus,
    type NewsSourceType,
  } from "@/domains/news-ingest/contracts";
  import { getExternalDomainLabel } from "@/shared/urls/domain-label";
  import {
    formatRelativeTime,
    postPath,
    type ApiTag,
  } from "@/shared/contracts";
  import { MAX_OPTIONAL_TAGS } from "@/domains/tags/model";
  import {
    buttonGhostSmClass,
    buttonPrimarySmClass,
    buttonSecondarySmClass,
    checkboxPillSmClass,
    inlinePrimaryLinkClass,
    inputClass,
    selectPrimarySmClass,
    textareaClass,
  } from "@/shared/ui/classes";

  type Notice = {
    tone: "success" | "error";
    message: string;
    href?: string | null;
    hrefLabel?: string | null;
  };

  type SourceRow = ApiNewsSource & {
    totalCount: number;
    visibleCount: number;
    pendingCount: number;
    convertedCount: number;
    dismissedCount: number;
    latestSeenAt: string | null;
    latestCandidateTitle: string | null;
  };

  export let initialSources: ApiNewsSource[] = [];
  export let initialCandidates: ApiNewsCandidate[] = [];
  export let optionalTags: ApiTag[] = [];
  export let pageSize = 12;

  let sources = [...initialSources];
  let candidates = [...initialCandidates];
  let statusFilter: NewsCandidateStatus | "all" = "pending";
  let typeFilter: NewsSourceType | "all" = "all";
  let selectedSourceId: string | null = null;
  let expandedCandidateId: string | null = null;
  let editor:
    | {
        candidateId: string;
        title: string;
        url: string;
        body: string;
        optionalTags: string[];
        pending: boolean;
        error: string | null;
      }
    | null = null;
  let page = 1;
  let pullPending = false;
  let rowPendingId: string | null = null;
  let notice: Notice | null = null;
  let itemSearch = "";

  const sourceTypeLabel = (value: NewsSourceType | null) =>
    value === "rss" ? "RSS" : value === "bluesky" ? "Bluesky" : "Unknown";

  const statusLabel = (value: NewsCandidateStatus) =>
    value === "pending" ? "Pending" : value === "dismissed" ? "Dismissed" : "Published";

  const statusClass = (value: NewsCandidateStatus) => {
    if (value === "pending") {
      return "border-primary/30 bg-primary/10 text-foreground";
    }
    if (value === "dismissed") {
      return "border-border bg-muted text-muted-foreground";
    }
    return "border-secondary/40 bg-secondary/20 text-foreground";
  };

  const parseTime = (value: string | null) => {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };

  const matchesStatusFilter = (candidate: ApiNewsCandidate) =>
    statusFilter === "all" || candidate.status === statusFilter;

  const getCandidateRecencyTime = (candidate: ApiNewsCandidate) => {
    const publishedTime = parseTime(candidate.publishedAt);
    if (publishedTime !== Number.NEGATIVE_INFINITY) {
      return publishedTime;
    }

    const lastSeenTime = parseTime(candidate.lastSeenAt);
    if (lastSeenTime !== Number.NEGATIVE_INFINITY) {
      return lastSeenTime;
    }

    return parseTime(candidate.firstSeenAt);
  };

  const sortCandidates = (items: ApiNewsCandidate[]) =>
    [...items].sort((left, right) => {
      const recencyDelta = getCandidateRecencyTime(right) - getCandidateRecencyTime(left);
      if (recencyDelta !== 0) {
        return recencyDelta;
      }

      const rank = (candidate: ApiNewsCandidate) =>
        candidate.status === "pending" ? 0 : candidate.status === "dismissed" ? 1 : 2;
      const rankDelta = rank(left) - rank(right);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return left.title.localeCompare(right.title);
    });

  const sortSourceRows = (items: SourceRow[]) =>
    [...items].sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      const seenDelta = parseTime(right.latestSeenAt) - parseTime(left.latestSeenAt);
      if (seenDelta !== 0) {
        return seenDelta;
      }

      return left.name.localeCompare(right.name);
    });

  const mergeCandidate = (candidate: ApiNewsCandidate) => {
    candidates = sortCandidates(
      candidates.some((item) => item.id === candidate.id)
        ? candidates.map((item) => (item.id === candidate.id ? candidate : item))
        : [...candidates, candidate],
    );
  };

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

  const normalizeSearchValue = (value: string) => value.trim().replace(/\s+/gu, " ").toLowerCase();

  const matchesItemSearch = (candidate: ApiNewsCandidate, query: string) => {
    if (!query) {
      return true;
    }

    const haystack = [
      candidate.title,
      toPlainPreviewText(candidate.excerpt) ?? candidate.excerpt ?? "",
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(query);
  };

  const buildSourceRows = (items: ApiNewsSource[], pool: ApiNewsCandidate[]) =>
    sortSourceRows(
      items
        .map((source) => {
          const related = sortCandidates(pool.filter((candidate) => candidate.sourceIds.includes(source.id)));
          const visible = related.filter((candidate) => matchesStatusFilter(candidate));

          return {
            ...source,
            totalCount: related.length,
            visibleCount: visible.length,
            pendingCount: related.filter((candidate) => candidate.status === "pending").length,
            convertedCount: related.filter((candidate) => candidate.status === "converted").length,
            dismissedCount: related.filter((candidate) => candidate.status === "dismissed").length,
            latestSeenAt: related[0]
              ? (
                  related[0].publishedAt ??
                  related[0].lastSeenAt ??
                  related[0].firstSeenAt
                )
              : null,
            latestCandidateTitle: related[0]?.title ?? null,
          } satisfies SourceRow;
        })
        .filter((source) => {
          if (typeFilter !== "all" && source.type !== typeFilter) {
            return false;
          }

          if (statusFilter === "all") {
            return true;
          }

          return source.visibleCount > 0;
        }),
    );

  const openEditor = (candidate: ApiNewsCandidate) => {
    if (expandedCandidateId === candidate.id) {
      expandedCandidateId = null;
      editor = null;
      return;
    }

    expandedCandidateId = candidate.id;
    editor = {
      candidateId: candidate.id,
      title: candidate.title,
      url: candidate.url,
      body: candidate.excerpt ?? "",
      optionalTags: [],
      pending: false,
      error: null,
    };
    notice = null;
  };

  const selectSource = (sourceId: string) => {
    if (selectedSourceId === sourceId) {
      return;
    }

    selectedSourceId = sourceId;
    expandedCandidateId = null;
    editor = null;
    page = 1;
    itemSearch = "";
    notice = null;
  };

  const dismissCandidate = async (candidate: ApiNewsCandidate) => {
    if (rowPendingId) {
      return;
    }

    rowPendingId = candidate.id;
    notice = null;

    try {
      const form = new FormData();
      form.set("candidateId", candidate.id);
      const result = await actions.dismissNewsCandidate(form);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data?.candidate) {
        throw new Error("Dismissal did not return candidate data.");
      }
      mergeCandidate(result.data.candidate);
      if (expandedCandidateId === candidate.id) {
        expandedCandidateId = null;
        editor = null;
      }
      notice = { tone: "success", message: "News item dismissed." };
    } catch (error) {
      notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Could not dismiss news item.",
      };
    } finally {
      rowPendingId = null;
    }
  };

  const pullSources = async () => {
    if (pullPending) {
      return;
    }

    pullPending = true;
    notice = null;

    try {
      const result = await actions.pullNewsSources(new FormData());
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data?.sources || !result?.data?.candidates || !result?.data?.summary) {
        throw new Error("Pull did not return refreshed admin data.");
      }

      sources = result.data.sources;
      candidates = sortCandidates(result.data.candidates);
      notice = {
        tone: result.data.summary.failedSources > 0 ? "error" : "success",
        message: result.data.summary.message,
      };
    } catch (error) {
      notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Could not pull sources.",
      };
    } finally {
      pullPending = false;
    }
  };

  const toggleOptionalTag = (slug: string) => {
    if (!editor) {
      return;
    }

    const selected = new Set(editor.optionalTags);
    if (selected.has(slug)) {
      selected.delete(slug);
    } else if (selected.size < MAX_OPTIONAL_TAGS) {
      selected.add(slug);
    }

    editor = {
      ...editor,
      optionalTags: Array.from(selected),
    };
  };

  const publishEditor = async () => {
    if (!editor || editor.pending) {
      return;
    }

    editor = { ...editor, pending: true, error: null };
    notice = null;

    try {
      const form = new FormData();
      form.set("candidateId", editor.candidateId);
      form.set("title", editor.title.trim());
      form.set("url", editor.url.trim());
      if (editor.body.trim()) {
        form.set("body", editor.body.trim());
      }
      editor.optionalTags.forEach((slug) => form.append("optionalTag", slug));

      const result = await actions.publishNewsCandidate(form);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (!result?.data?.candidate || !result.data.post) {
        throw new Error("Publish did not return post data.");
      }

      mergeCandidate(result.data.candidate);
      expandedCandidateId = null;
      editor = null;
      notice = {
        tone: "success",
        message: "News post published.",
        href: result.data.redirectTo ?? postPath(result.data.post),
        hrefLabel: "Open post",
      };
    } catch (error) {
      editor = {
        ...editor,
        pending: false,
        error: error instanceof Error ? error.message : "Could not publish news item.",
      };
    }
  };

  $: sourceRows = buildSourceRows(sources, candidates);
  $: pendingCount = candidates.filter((candidate) => candidate.status === "pending").length;
  $: enabledSourceCount = sources.filter((source) => source.enabled).length;
  $: selectedSource = sourceRows.find((source) => source.id === selectedSourceId) ?? null;
  $: normalizedItemSearch = normalizeSearchValue(itemSearch);
  $: selectedSourceCandidates = selectedSourceId
    ? sortCandidates(
        candidates.filter((candidate) =>
          candidate.sourceIds.includes(selectedSourceId)
          && matchesStatusFilter(candidate)
          && matchesItemSearch(candidate, normalizedItemSearch)
        ),
      )
    : [];
  $: editorSourceType = selectedSource?.type ?? null;

  $: {
    if (sourceRows.length === 0) {
      selectedSourceId = null;
      expandedCandidateId = null;
      editor = null;
      page = 1;
    } else if (!selectedSourceId || !sourceRows.some((source) => source.id === selectedSourceId)) {
      selectedSourceId = sourceRows[0]?.id ?? null;
      expandedCandidateId = null;
      editor = null;
      page = 1;
    }
  }

  $: {
    if (expandedCandidateId && !selectedSourceCandidates.some((candidate) => candidate.id === expandedCandidateId)) {
      expandedCandidateId = null;
      editor = null;
    }
  }

  $: totalPages = Math.max(1, Math.ceil(selectedSourceCandidates.length / pageSize));
  $: page = Math.min(page, totalPages);
  $: pageStart = (page - 1) * pageSize;
  $: pagedCandidates = selectedSourceCandidates.slice(pageStart, pageStart + pageSize);
  $: pageItems = buildPageItems(page, totalPages);
</script>

<div class="space-y-5">
  <section class="rkn-panel overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/75 px-5 py-4 text-sm">
      <div class="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>{pendingCount} pending</span>
        <span aria-hidden="true">•</span>
        <span>{enabledSourceCount}/{sources.length} enabled sources</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class={buttonPrimarySmClass} disabled={pullPending} on:click={pullSources}>
          {pullPending ? "Pulling..." : "Pull enabled sources"}
        </button>
        <a href="/admin/news/sources" class={buttonSecondarySmClass}>Manage sources</a>

        <label class="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>Status</span>
          <select bind:value={statusFilter} class={selectPrimarySmClass}>
            <option value="pending">Pending</option>
            <option value="dismissed">Dismissed</option>
            <option value="converted">Published</option>
            <option value="all">All</option>
          </select>
        </label>

        <label class="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>Type</span>
          <select bind:value={typeFilter} class={selectPrimarySmClass}>
            <option value="all">All</option>
            <option value="rss">RSS</option>
            <option value="bluesky">Bluesky</option>
          </select>
        </label>
      </div>
    </div>

    {#if notice}
      <p
        class={`flex flex-wrap items-center gap-2 border-b px-5 py-3 text-sm ${
          notice.tone === "error" ? "border-destructive/30 bg-destructive/6 text-destructive" : "border-border/70 bg-muted/20 text-foreground"
        }`}
        role={notice.tone === "error" ? "alert" : "status"}
      >
        <span>{notice.message}</span>
        {#if notice.href}
          <a href={notice.href} class={inlinePrimaryLinkClass}>{notice.hrefLabel ?? "Open"}</a>
        {/if}
      </p>
    {/if}

    {#if sources.length === 0}
      <div class="space-y-3 px-5 py-8 text-sm text-muted-foreground">
        <p>No sources configured yet.</p>
        <a href="/admin/news/sources" class={inlinePrimaryLinkClass}>Add RSS or Bluesky sources</a>
      </div>
    {:else if sourceRows.length === 0}
      <div class="px-5 py-8 text-sm text-muted-foreground">
        No sources match the current filters.
      </div>
    {:else}
      <div class="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside class="border-b border-border/75 lg:border-b-0 lg:border-r lg:border-border/75">
          <div class="flex h-[calc(var(--rkn-control-md-height)+1.5rem)] items-center justify-between border-b border-border/75 px-4 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            <span>Sources</span>
            <span>{sourceRows.length}</span>
          </div>

          <div class="max-h-[42rem] overflow-y-auto">
            <div class="divide-y divide-border/75">
              {#each sourceRows as source (source.id)}
                <button
                  type="button"
                  class={`block w-full cursor-pointer border-l-2 px-4 py-3 text-left transition-colors ${
                    selectedSourceId === source.id
                      ? "border-primary bg-primary/6"
                      : "border-transparent bg-card/50 hover:bg-muted/24"
                  }`}
                  on:click={() => selectSource(source.id)}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="truncate text-sm font-semibold text-foreground">{source.name}</span>
                        <span class="rounded-none border border-border bg-muted px-2 py-0.5 text-[10px] tracking-wide uppercase text-muted-foreground">
                          {sourceTypeLabel(source.type)}
                        </span>
                        {#if !source.enabled}
                          <span class="rounded-none border border-border bg-card px-2 py-0.5 text-[10px] tracking-wide uppercase text-muted-foreground">
                            Disabled
                          </span>
                        {/if}
                      </div>

                      <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{source.pendingCount} pending</span>
                        <span aria-hidden="true">•</span>
                        <span>{source.totalCount} total</span>
                        {#if source.lastPulledAt}
                          <span aria-hidden="true">•</span>
                          <span>{formatRelativeTime(source.lastPulledAt)}</span>
                        {/if}
                      </div>

                      {#if source.latestCandidateTitle}
                        <p class="truncate text-[11px] text-muted-foreground">
                          {source.latestCandidateTitle}
                        </p>
                      {/if}
                    </div>

                    <div class="shrink-0 text-right">
                      <div class="text-sm font-semibold text-foreground">{source.visibleCount}</div>
                      <div class="text-[10px] tracking-wide text-muted-foreground uppercase">shown</div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          {#if selectedSource}
            <div class="flex h-[calc(var(--rkn-control-md-height)+1.5rem)] items-center border-b border-border/75 px-5">
              <label class="block w-full">
                <span class="sr-only">Search items</span>
                <input
                  bind:value={itemSearch}
                  class={inputClass}
                  type="search"
                  placeholder="Search this source by title or content"
                  on:input={() => (page = 1)}
                />
              </label>
            </div>

            {#if pagedCandidates.length === 0}
              <div class="px-5 py-8 text-sm text-muted-foreground">
                No items from this source match the current filters{normalizedItemSearch ? " or search" : ""}.
              </div>
            {:else}
              <div class="divide-y divide-border/75">
                {#each pagedCandidates as candidate (candidate.id)}
                  <article
                    class={`transition-colors ${
                      expandedCandidateId === candidate.id ? "bg-primary/5" : "bg-card/50"
                    }`}
                  >
                    <div class="grid gap-3 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <button
                        type="button"
                        class="min-w-0 cursor-pointer text-left disabled:cursor-default"
                        aria-expanded={expandedCandidateId === candidate.id}
                        disabled={candidate.status === "converted"}
                        on:click={() => openEditor(candidate)}
                      >
                        <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span class={`rounded-none border px-2 py-0.5 tracking-wide uppercase ${statusClass(candidate.status)}`}>
                            {statusLabel(candidate.status)}
                          </span>
                          <span>{getExternalDomainLabel(candidate.url) ?? "External link"}</span>
                          <span aria-hidden="true">•</span>
                          <span>{candidate.sourceIds.length} sources</span>
                          <span aria-hidden="true">•</span>
                          <span>{candidate.publishedAt ? `Published ${formatRelativeTime(candidate.publishedAt)}` : `Seen ${formatRelativeTime(candidate.lastSeenAt)}`}</span>
                        </div>

                        <div class="mt-1 text-sm font-semibold leading-snug text-foreground">
                          {candidate.title}
                        </div>

                        {#if candidate.excerpt}
                          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {clipText(candidate.excerpt, 180, editorSourceType === "rss")}
                          </p>
                        {/if}
                      </button>

                      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                        <a href={candidate.url} target="_blank" rel="noreferrer" class={buttonGhostSmClass}>
                          Source
                        </a>

                        {#if candidate.status === "converted" && candidate.convertedPostId}
                          <a href={postPath({ id: candidate.convertedPostId })} class={buttonSecondarySmClass}>
                            Open post
                          </a>
                        {:else}
                          <button
                            type="button"
                            class={buttonGhostSmClass}
                            disabled={rowPendingId === candidate.id}
                            on:click={() => dismissCandidate(candidate)}
                          >
                            {rowPendingId === candidate.id ? "Dismissing..." : "Dismiss"}
                          </button>
                        {/if}
                      </div>
                    </div>

                    {#if expandedCandidateId === candidate.id && editor}
                      <div class="border-t border-border/75 bg-muted/18 px-5 py-5">
                        <div class="mb-5 space-y-2">
                          <p class="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Editor</p>
                          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{getExternalDomainLabel(candidate.url) ?? "External link"}</span>
                            <span aria-hidden="true">•</span>
                            <a href={candidate.url} class={inlinePrimaryLinkClass} target="_blank" rel="noreferrer">
                              Open source
                            </a>
                          </div>
                        </div>

                        <form class="space-y-5" on:submit|preventDefault={publishEditor}>
                          <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <label class="space-y-1">
                              <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Title</span>
                              <input bind:value={editor.title} class={inputClass} maxlength={240} required />
                            </label>

                            <label class="space-y-1">
                              <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">URL</span>
                              <input bind:value={editor.url} class={inputClass} type="url" inputmode="url" required />
                            </label>
                          </div>

                          <label class="block space-y-1">
                            <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Summary</span>
                            <textarea
                              bind:value={editor.body}
                              class={`${textareaClass} min-h-[11rem] leading-relaxed`}
                              maxlength={20000}
                              placeholder="Add the context that belongs on rawkode.news."
                            ></textarea>
                          </label>

                          <div class="space-y-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <div class="space-y-1">
                                <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                  Tags
                                </span>
                                <div class="flex flex-wrap items-center gap-2">
                                  <span class="rounded-none border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-semibold tracking-wide text-foreground uppercase">
                                    News
                                  </span>
                                  <span class="text-xs text-muted-foreground">Required feed tag</span>
                                </div>
                              </div>
                              <span class={`text-xs ${editor.optionalTags.length >= MAX_OPTIONAL_TAGS ? "text-destructive" : "text-muted-foreground"}`}>
                                {editor.optionalTags.length}/{MAX_OPTIONAL_TAGS} selected
                              </span>
                            </div>

                            {#if optionalTags.length === 0}
                              <p class="text-sm text-muted-foreground">
                                No optional tags yet. Publishing will use the required <strong>News</strong> tag only.
                              </p>
                            {:else}
                              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                {#each optionalTags as tag (tag.id)}
                                  <label class={checkboxPillSmClass} title={tag.description ?? undefined}>
                                    <input
                                      type="checkbox"
                                      class="peer sr-only"
                                      checked={editor.optionalTags.includes(tag.slug)}
                                      disabled={!editor.optionalTags.includes(tag.slug) && editor.optionalTags.length >= MAX_OPTIONAL_TAGS}
                                      on:change={() => toggleOptionalTag(tag.slug)}
                                    />
                                    <span class="min-w-0 truncate" dir="auto">{tag.name}</span>
                                  </label>
                                {/each}
                              </div>
                            {/if}
                          </div>

                          {#if editor.error}
                            <p role="alert" class="text-sm text-destructive">{editor.error}</p>
                          {/if}

                          <div class="flex flex-wrap items-center gap-2">
                            <button
                              type="submit"
                              class={buttonPrimarySmClass}
                              disabled={editor.pending || !editor.title.trim() || !editor.url.trim()}
                            >
                              {editor.pending ? "Publishing..." : "Publish to news"}
                            </button>
                            <button type="button" class={buttonSecondarySmClass} on:click={() => openEditor(candidate)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    {/if}
                  </article>
                {/each}
              </div>
            {/if}

            {#if totalPages > 1}
              <nav
                aria-label="News candidate pagination"
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
        </div>
      </div>
    {/if}
  </section>
</div>
