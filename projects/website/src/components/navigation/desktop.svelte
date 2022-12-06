<script lang="ts">
  import { menuItems } from "config/menu";

  import { onMount } from "svelte";

  let url = ``;

  onMount(() => (url = window.location.pathname));
</script>

<nav class="desktop-navigation">
  {#each menuItems as menuItem}
    <a
      href={menuItem.href}
      class="group flex items-center px-2 py-2 text-sm font-medium text-black {url.match(
        menuItem.regex
      )
        ? 'underline'
        : ''}"
    >
      {menuItem.title}
    </a>
  {/each}
</nav>
