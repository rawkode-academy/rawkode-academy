<script>
 import InfiniteScroll from "svelte-infinite-scroll";
  export let list;

  let page = 0;
  let size = 14;
  let episodes = [];

  $:episodes = [
    ...episodes,
    ...list.slice(size * page, size * (page + 1) - 1)
  ];
</script>
<ul>
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


<InfiniteScroll threshold={0} on:loadMore={() => {page++; console.log('LOAD MORE')}} />
</ul>

