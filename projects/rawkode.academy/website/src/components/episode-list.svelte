<script>
  export let list;

  let page = 1;
  let size = 14;
</script>

<ul class="episodes__list">
  {#each list.slice(0, (page * size)) as episode}
  <li>
    <a href={`https://www.youtube.com/watch?v=${episode.youtube_id}`} target="_blank" class="episode__card" rel="noreferrer">
      <div class="episode__content">
        <p>{episode.title}</p>
        <img src={`https://img.youtube.com/vi/${episode.youtube_id}/hqdefault.jpg`} alt={episode.title} />
      </div>
    </a>
  </li>
{/each}
</ul>
{#if (page * size) < list.length}
<button on:click={() => {page++;}} type="button" class="button--load-more">Load more</button>
{/if}
