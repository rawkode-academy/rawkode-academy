<script lang="ts">
  import { onMount } from "svelte";
  import { formatInteger, parseApiPostList, type ApiPost } from "@/lib/contracts";
  import {
    buttonGhostSmClass,
    buttonPrimarySmClass,
    buttonSecondarySmClass,
    inputClass,
  } from "@/lib/ui-classes";

  type SearchPost = ApiPost;
  type SearchStatusTone = "idle" | "loading" | "success" | "warning" | "error";

  const SEARCH_DEBOUNCE_MS = 350;
  const SEARCH_REQUEST_TIMEOUT_MS = 8_000;
  const MIN_QUERY_LENGTH = 2;
  const MAX_QUERY_LENGTH = 200;
  const SEARCH_RESULT_LIMIT = 40;

  export let initialQuery = "";
  export let searchIndexEndpoint = "/api/search-index";

  let query = "";
  let debouncedQuery = "";
  let statusMessage = "";
  let statusTone: SearchStatusTone = "idle";
  let hasRecoverableError = false;
  let results: SearchPost[] = [];
  let noResultsQuery = "";
  let fromPath = "/search";
  let isSearching = false;
  let PostRowComponent: (typeof import("@/components/feed/PostRowSvelte.svelte"))["default"] | null = null;

  let activeController: AbortController | null = null;
  let activeRequestToken = 0;
  let timer = 0;
  let postRowLoader: Promise<void> | null = null;

  const normalizeQuery = (value: string) => value.trim().slice(0, MAX_QUERY_LENGTH);
  const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

  const setStatus = (
    message: string,
    tone: SearchStatusTone = "idle",
    recoverable = false,
  ) => {
    statusMessage = message;
    statusTone = tone;
    hasRecoverableError = recoverable;
  };

  const updateLocation = (nextQuery: string) => {
    const next = new URLSearchParams(window.location.search);
    if (nextQuery) {
      next.set("q", nextQuery);
    } else {
      next.delete("q");
    }

    const nextSearch = next.toString();
    const nextHref = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    history.replaceState(history.state, "", nextHref);
    fromPath = `${window.location.pathname}${window.location.search}`;
  };

  const getApiErrorMessage = (status: number) => {
    if (status === 401) return "Sign in to search posts.";
    if (status === 403) return "Your account does not have access to search.";
    if (status === 429) return "Too many search requests. Wait a few seconds and try again.";
    if (status >= 500) return "Search is temporarily unavailable. Please try again.";
    return `Search failed (${status}). Please try again.`;
  };

  const ensurePostRowComponent = async () => {
    if (PostRowComponent) {
      return;
    }
    if (!postRowLoader) {
      postRowLoader = import("@/components/feed/PostRowSvelte.svelte")
        .then((module) => {
          PostRowComponent = module.default;
        })
        .finally(() => {
          postRowLoader = null;
        });
    }
    await postRowLoader;
  };

  const runSearch = async () => {
    const token = ++activeRequestToken;
    const nextQuery = normalizeQuery(debouncedQuery);
    updateLocation(nextQuery);
    results = [];
    noResultsQuery = "";

    if (!nextQuery) {
      setStatus("", "idle");
      return;
    }

    if (nextQuery.length < MIN_QUERY_LENGTH) {
      setStatus(`Use at least ${MIN_QUERY_LENGTH} characters to search.`, "warning");
      return;
    }

    if (isOffline()) {
      setStatus("You're offline. Reconnect, then run search again.", "error", true);
      return;
    }

    activeController?.abort("superseded");
    const controller = new AbortController();
    activeController = controller;
    isSearching = true;
    setStatus("Searching…", "loading");

    let timeoutId = 0;

    try {
      timeoutId = window.setTimeout(() => {
        controller.abort("timeout");
      }, SEARCH_REQUEST_TIMEOUT_MS);

      const response = await fetch(
        `${searchIndexEndpoint}?q=${encodeURIComponent(nextQuery)}&limit=${SEARCH_RESULT_LIMIT}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );

      if (token !== activeRequestToken) {
        return;
      }

      if (!response.ok) {
        setStatus(getApiErrorMessage(response.status), "error", true);
        return;
      }

      const payload = await response.json();
      const posts = parseApiPostList(payload);
      if (!posts) {
        setStatus("Search returned an unexpected response. Please try again.", "error", true);
        return;
      }

      if (posts.length === 0) {
        noResultsQuery = nextQuery;
        setStatus(`No posts matched “${nextQuery}”.`, "warning");
        return;
      }

      if (!PostRowComponent) {
        void ensurePostRowComponent();
      }
      results = posts;
      setStatus("", "success");
    } catch (error) {
      if (token !== activeRequestToken) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        if (isOffline()) {
          setStatus("Connection dropped while searching. Check your network and try again.", "error", true);
        } else if (controller.signal.reason === "timeout") {
          setStatus("Search took too long. Please try again.", "error", true);
        }
        return;
      }

      setStatus("Search failed. Please try again.", "error", true);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (activeController === controller) {
        activeController = null;
      }
      if (token === activeRequestToken) {
        isSearching = false;
      }
    }
  };

  const retrySearch = async () => {
    await runSearch();
  };

  const commitSearch = () => {
    window.clearTimeout(timer);
    debouncedQuery = normalizeQuery(query);
    void runSearch();
  };

  const clearSearch = () => {
    window.clearTimeout(timer);
    activeRequestToken += 1;
    activeController?.abort("cleared");
    activeController = null;
    isSearching = false;
    query = "";
    debouncedQuery = "";
    results = [];
    noResultsQuery = "";
    updateLocation("");
    setStatus("", "idle");
  };

  const handleInput = (event: Event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    query = target.value;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      debouncedQuery = normalizeQuery(query);
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);
  };

  onMount(() => {
    const handleOffline = () => {
      setStatus("You're offline. Search is unavailable until you're back online.", "error", true);
    };
    const handleOnline = () => {
      if (hasRecoverableError && normalizeQuery(query).length >= MIN_QUERY_LENGTH) {
        setStatus("You're back online. Run search again.", "warning", true);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const params = new URLSearchParams(window.location.search);
    query = normalizeQuery(params.get("q") ?? initialQuery);
    debouncedQuery = query;
    fromPath = `${window.location.pathname}${window.location.search}`;
    if (debouncedQuery.length >= MIN_QUERY_LENGTH) {
      void runSearch();
    }

    return () => {
      window.clearTimeout(timer);
      activeController?.abort("component-unmounted");
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  });
</script>

<div class="space-y-3 border-b border-border/75 pb-4">
  <form class="space-y-3" on:submit|preventDefault={commitSearch}>
    <div class="space-y-2">
      <label for="search-posts-input" class="text-sm font-semibold text-foreground">
        Search posts
      </label>
      <input
        id="search-posts-input"
        value={query}
        maxlength={MAX_QUERY_LENGTH}
        aria-describedby={statusMessage ? "search-hint search-status" : "search-hint"}
        class={inputClass}
        placeholder="Try: kubernetes scheduler, cilium, platform engineering"
        autocomplete="off"
        on:input={handleInput}
      />
    </div>

    <div class="text-xs text-muted-foreground">
      <p id="search-hint">Search across titles, summaries, authors, and source domains.</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        class={buttonPrimarySmClass}
        disabled={isSearching || normalizeQuery(query).length === 0}
      >
        {isSearching ? "Searching…" : "Search"}
      </button>
      {#if query || debouncedQuery || results.length > 0}
        <button
          type="button"
          class={buttonGhostSmClass}
          on:click={clearSearch}
        >
          Clear
        </button>
      {/if}
      {#if hasRecoverableError}
        <button type="button" class={buttonSecondarySmClass} on:click={retrySearch}>
          Retry
        </button>
      {/if}
    </div>

    {#if statusMessage}
      <p
        id="search-status"
        role={statusTone === "error" ? "alert" : "status"}
        aria-live={statusTone === "error" ? "assertive" : "polite"}
        class={statusTone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {statusMessage}
      </p>
    {/if}
  </form>
</div>

<div class="rkn-panel mt-2 overflow-hidden" aria-busy={isSearching ? "true" : "false"}>
{#if results.length > 0}
    {#if PostRowComponent}
      <div id="search-results" class="rkn-post-list">
        {#each results as post, index (post.id)}
          <svelte:component this={PostRowComponent} post={post} from={fromPath} />
          {#if index < results.length - 1}
            <hr class="rkn-post-row-separator border-border/75" />
          {/if}
        {/each}
      </div>
    {:else}
      <div class="space-y-2 px-[clamp(1rem,2.1vw,1.25rem)] py-6 text-sm text-muted-foreground">
        <p>Loading results…</p>
      </div>
    {/if}
  {:else if hasRecoverableError}
    <div class="space-y-2 px-[clamp(1rem,2.1vw,1.25rem)] py-6 text-sm text-destructive">
      <p>Use Retry above to run this search again.</p>
    </div>
  {:else if noResultsQuery}
    <div class="space-y-2 px-[clamp(1rem,2.1vw,1.25rem)] py-6 text-sm text-muted-foreground">
      <p class="text-xs">Try broader keywords or search by author/source domain.</p>
    </div>
  {:else}
    <div class="space-y-2 px-[clamp(1rem,2.1vw,1.25rem)] py-6 text-sm text-muted-foreground">
      <p>Search by keyword, author, or source domain.</p>
      <p class="text-xs">Results are limited to the top {formatInteger(SEARCH_RESULT_LIMIT)} matches.</p>
    </div>
  {/if}
</div>
