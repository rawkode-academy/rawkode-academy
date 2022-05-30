<script lang="ts">
  import { menuItems } from "config/menu";
  import Icon from "@iconify/svelte";

  import { onMount } from "svelte";

  let url = ``;

  onMount(() => (url = window.location.pathname));
</script>

<div class="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
  <!-- Sidebar component, swap this element with another sidebar if you like -->
  <div class="flex flex-col flex-grow pt-5 overflow-y-auto bg-primary">
    <div class="flex items-center flex-shrink-0 px-4">
      <img class="h-12 w-auto" src="/logo-white.png" alt="Rawkode Academy" />
    </div>
    <div class="mt-5 flex-1 flex flex-col">
      <nav class="flex-1 px-2 pb-4 space-y-1">
        {#each menuItems as menuItem}
          <a
            href={menuItem.href}
            class="text-white group flex items-center px-2 py-2 text-sm font-medium rounded-md {url ==
            menuItem.href
              ? 'bg-secondary'
              : 'bg-primary'}"
          >
            <Icon icon={menuItem.icon} class="w-5 h-5 mr-3" />
            {menuItem.title}
          </a>
        {/each}
      </nav>
    </div>
  </div>
</div>
