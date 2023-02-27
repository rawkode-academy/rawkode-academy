<script>
  import InfiniteLoading from 'svelte-infinite-loading';
  export let list;

  function infiniteHandler({ detail: { loaded, complete } }) {
		fetch(`${api}&page=${page}`)
			.then(response => response.json())
			.then(data => {
        if (data.hits.length) {
          page += 1;
          list = [...list, ...data.hits];
          loaded();
        } else {
          complete();
        }
      });
	}
</script>

<div>
  {#each list as episode}
    <a href={`https://www.youtube.com/watch?v=${episode.youtube_id}`} target="_blank" class="episode__card" rel="noreferrer">
      <div class="episode__content">
        <p>{episode.title}</p>
        <img src={`https://img.youtube.com/vi/${episode.youtube_id}/hqdefault.jpg`} alt={episode.title} />
      </div>
    </a>
  {/each}

  <InfiniteLoading on:infinite={infiniteHandler} />
</div>
