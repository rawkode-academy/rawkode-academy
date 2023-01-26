<script lang="ts">
  import {
    Header,
    Content,
    Row,
    Column,
    Grid,
    Tile,
    HeaderAction,
    HeaderNav,
    HeaderNavItem,
    HeaderGlobalAction,
    HeaderNavMenu,
  } from "carbon-components-svelte";
  import Episodes from "./pages/Episodes.svelte";
  import Index from "./pages/Index.svelte";
  import People from "./pages/People.svelte";
  import Shows from "./pages/Shows.svelte";
  import Technologies from "./pages/Technologies.svelte";

  const pages = [
    "home",
    "shows",
    "episodes",
    "technologies",
    "people",
  ] as const;

  type Page = typeof pages[number];

  let selectedPage: Page = "home";

  function changePage(page: Page): void {
    selectedPage = page;
  }

  function capitalize(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }
</script>

<Header company="RAWKODE" platformName="studio">
  <HeaderNav>
    {#each pages as page}
      <HeaderNavItem
        href="#"
        text={capitalize(page)}
        on:click={() => changePage(page)}
      />
    {/each}
  </HeaderNav>
</Header>

<Content>
  <Grid>
    <Row>
      <Column>
        {#if selectedPage === "home"}
          <Index />
        {:else if selectedPage === "shows"}
          <Shows />
        {:else if selectedPage === "episodes"}
          <Episodes />
        {:else if selectedPage === "technologies"}
          <Technologies />
        {:else if selectedPage === "people"}
          <People />
        {:else}
          <Index />
        {/if}
      </Column>
    </Row>
  </Grid>
</Content>
