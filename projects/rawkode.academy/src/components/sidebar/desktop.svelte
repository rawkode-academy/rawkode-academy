<script lang="ts">
  import { menuItems } from "config/menu";
  import Icon from "@iconify/svelte";
</script>

<div class="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
  <!-- Sidebar component, swap this element with another sidebar if you like -->
  <div class="flex flex-col flex-grow pt-5 bg-indigo-700 overflow-y-auto">
    <div class="flex items-center flex-shrink-0 px-4">
      <img
        class="h-8 w-auto"
        src="https://tailwindui.com/img/logos/workflow-logo-indigo-300-mark-white-text.svg"
        alt="Workflow"
      />
    </div>
    <div class="mt-5 flex-1 flex flex-col">
      <nav class="flex-1 px-2 pb-4 space-y-1">
        {#each menuItems as menuItem}
          <a
            href={menuItem.href}
            class="bg-indigo-800 text-white group flex items-center px-2 py-2 text-sm font-medium rounded-md"
          >
            <Icon icon={menuItem.icon} class="w-5 h-5 mr-3" />
            {menuItem.title}
          </a>
        {/each}
      </nav>
    </div>
  </div>
</div>
