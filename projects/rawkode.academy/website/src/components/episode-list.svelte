<script>
  import InfiniteScroll from "@components/infinite-scroll.svelte";
  export let list;

  let page = 0;
  let size = 14;
  let episodes = [];

  $:episodes = [
    ...episodes,
    ...list.slice(size * page, (page + 1) * size),
  ];

  const handleClick = () => {
    page++;
  };
</script>

<ul class="episodes__list">
  {#each episodes as episode}
    <li>
      <a href={`https://www.youtube.com/watch?v=${episode.youtube_id}`} target="_blank" class="episode__card" rel="noreferrer">
        <div class="episode__content">
          <p>{episode.title}</p>
          <img src={`https://img.youtube.com/vi/${episode.youtube_id}/hqdefault.jpg`} alt={episode.title} />
        </div>
      </a>
    </li>
  {/each}
  <InfiniteScroll
    client:load
    hasMore={episodes.length < list.length}
    threshold={10}
    on:loadMore={() => handleClick()} />
</ul>
{#if episodes.length < list.length}
<button
    on:click={handleClick}
    class="button--load-more"
    type="button"
  >
    Load more
  </button>
{/if}
{#if episodes.length === list.length && page > 0}
  <p class="end-of-episodes">End of episodes</p>
{/if}
