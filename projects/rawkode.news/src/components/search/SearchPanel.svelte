<script lang="ts">
  import Fuse, { type FuseResult } from "fuse.js";
  import { onMount } from "svelte";
  import PostRowSvelte from "@/components/feed/PostRowSvelte.svelte";
  import { parseApiPostList, type ApiPost } from "@/lib/contracts";
  import { inputClass } from "@/lib/ui-classes";

  type SearchPost = ApiPost;

  const SEARCH_DEBOUNCE_MS = 350;
  const MIN_QUERY_LENGTH = 2;
  const MAX_QUERY_LENGTH = 200;
  const SEARCH_RESULT_LIMIT = 40;

  export let initialQuery = "";
  export let searchIndexEndpoint = "/api/search-index";

  let query = "";
  let debouncedQuery = "";
  let statusMessage = "Type a query to start searching.";
  let results: SearchPost[] = [];
  let fromPath = "/search";

  let loadingIndex = false;
  let indexReady = false;
  let fuse: Fuse<SearchPost> | null = null;

  let timer = 0;

  const normalizeQuery = (value: string) => value.trim().slice(0, MAX_QUERY_LENGTH);

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

  const ensureIndex = async () => {
    if (indexReady || loadingIndex) {
      return;
    }

    loadingIndex = true;
    statusMessage = "Loading search index...";

    try {
      const response = await fetch(searchIndexEndpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error("Failed to load search index");
      }

      const payload = await response.json();
      const posts = parseApiPostList(payload);
      if (!posts) {
        throw new Error("Invalid search index response");
      }
      fuse = new Fuse(posts, {
        includeScore: true,
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: MIN_QUERY_LENGTH,
        keys: [
          { name: "title", weight: 0.5 },
          { name: "body", weight: 0.3 },
          { name: "author", weight: 0.12 },
          { name: "url", weight: 0.08 },
        ],
      });

      indexReady = true;
    } catch {
      statusMessage = "Could not load search data. Try again shortly.";
    } finally {
      loadingIndex = false;
    }
  };

  const runSearch = async () => {
    const nextQuery = normalizeQuery(debouncedQuery);
    updateLocation(nextQuery);
    results = [];

    if (!nextQuery) {
      statusMessage = "Type a query to start searching.";
      return;
    }

    if (nextQuery.length < MIN_QUERY_LENGTH) {
      statusMessage = `Type at least ${MIN_QUERY_LENGTH} characters to search.`;
      return;
    }

    if (!fuse) {
      await ensureIndex();
      if (!fuse) {
        return;
      }
    }

    const matches = fuse.search(nextQuery, { limit: SEARCH_RESULT_LIMIT });
    if (matches.length === 0) {
      statusMessage = `No matches for “${nextQuery}”.`;
      return;
    }

    results = matches.map((entry: FuseResult<SearchPost>) => entry.item);
    statusMessage = `${results.length} results`;
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
    const params = new URLSearchParams(window.location.search);
    query = normalizeQuery(params.get("q") ?? initialQuery);
    debouncedQuery = query;
    fromPath = `${window.location.pathname}${window.location.search}`;
    void runSearch();

    return () => {
      window.clearTimeout(timer);
    };
  });
</script>

<div class="rkn-panel space-y-3 p-5">
  <div class="space-y-2">
    <label for="search-posts-input" class="text-sm font-semibold text-foreground">
      Query
    </label>
    <input
      id="search-posts-input"
      value={query}
      class={inputClass}
      placeholder="Search by title, topic, author, or source"
      autocomplete="off"
      on:input={handleInput}
    />
  </div>

  <p id="search-status" class="text-sm text-muted-foreground">{statusMessage}</p>
</div>

{#if results.length > 0}
  <div class="rkn-panel mt-2 overflow-hidden">
    <div id="search-results" class="rkn-post-list">
      {#each results as post, index (post.id)}
        <PostRowSvelte post={post} from={fromPath} />
        {#if index < results.length - 1}
          <hr class="rkn-post-row-separator border-border/75" />
        {/if}
      {/each}
    </div>
  </div>
{/if}
