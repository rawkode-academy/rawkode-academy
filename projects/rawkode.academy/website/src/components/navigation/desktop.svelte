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
      target={menuItem.target || "_self"}
      class="group flex items-center px-2 py-2 font-medium text-black {url.match(
        menuItem.regex
      )
        ? 'underline'
        : ''}"
    >
      {menuItem.title}
    </a>
  {/each}
</nav>
