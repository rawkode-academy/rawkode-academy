<script lang="ts">
  import { menuItems } from "config/menu";

  import { onMount } from "svelte";

  let url = ``;

  onMount(() => (url = window.location.pathname));
</script>

<div class="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-black">
  <div class="flex flex-col flex-grow pt-5 overflow-y-auto">
    <div class="flex items-center flex-shrink-0 px-4">
      <img class="h-12 w-auto" src="/logo-white.png" alt="Rawkode Academy" />
    </div>
    <div class="mt-5 flex-1 flex flex-col">
      <nav class="flex-1 px-2 pb-4 space-y-1">
        {#each menuItems as menuItem}
          <a
            href={menuItem.href}
            class="group flex items-center px-2 py-2 text-sm font-medium rounded-md bg-black hover:bg-emerald-400 hover:text-white {url.startsWith(
              menuItem.href
            )
              ? 'text-black font-semibold bg-gradient-to-br from-primary to-secondary'
              : 'text-white'}"
          >
            {menuItem.title}
          </a>
        {/each}
      </nav>
    </div>
  </div>
</div>
