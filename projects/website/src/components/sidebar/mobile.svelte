<script lang="ts">
  import Icon from "@iconify/svelte";
  import { menuItems } from "config/menu";
  import { isOpen } from "./store";

  import { onMount } from "svelte";

  let url = ``;

  onMount(() => (url = window.location.pathname));
</script>

{#if $isOpen}
  <!-- Off-canvas menu for mobile, show/hide based on off-canvas menu state. -->
  <div class="relative z-40" role="dialog" aria-modal="true">
    <!--
  Off-canvas menu backdrop, show/hide based on off-canvas menu state.

  Entering: "transition-opacity ease-linear duration-300"
    From: "opacity-0"
    To: "opacity-100"
  Leaving: "transition-opacity ease-linear duration-300"
    From: "opacity-100"
    To: "opacity-0"
-->
    <div class="fixed inset-0 bg-gray-600 bg-opacity-75" />

    <div class="fixed inset-0 flex z-40">
      <!--
    Off-canvas menu, show/hide based on off-canvas menu state.

    Entering: "transition ease-in-out duration-300 transform"
      From: "-translate-x-full"
      To: "translate-x-0"
    Leaving: "transition ease-in-out duration-300 transform"
      From: "translate-x-0"
      To: "-translate-x-full"
  -->
      <div
        class="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-black"
      >
        <!--
      Entering: "ease-in-out duration-300"
        From: "opacity-0"
        To: "opacity-100"
      Leaving: "ease-in-out duration-300"
        From: "opacity-100"
        To: "opacity-0"
    -->
        <!-- Close Button -->
        <div class="absolute top-0 right-0 -mr-12 pt-2">
          <button
            type="button"
            on:click={() => isOpen.set(false)}
            class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <span class="sr-only">Close sidebar</span>
            <!-- Heroicon name: outline/x -->
            <svg
              class="h-6 w-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="flex-shrink-0 flex items-center px-4">
          <img
            src="/logo-white.png"
            alt="Rawkode Academy logo"
            width="150"
            height="40"
          />
        </div>
        <div class="mt-5 flex-1 h-0 overflow-y-auto">
          <nav class="px-2 space-y-1">
            {#each menuItems as menuItem}
              <a
                href={menuItem.href}
                class="text-white group flex items-center px-2 py-2 text-base font-medium rounded-md bg-black hover:bg-emerald-400 hover:text-white {url ==
                menuItem.href
                  ? 'text-black font-semibold bg-gradient-to-br from-primary to-secondary'
                  : 'text-white'}"
              >
                <Icon icon={menuItem.icon} class="w-5 h-5 mr-3" />
                {menuItem.title}
              </a>
            {/each}
          </nav>
        </div>
      </div>

      <div class="flex-shrink-0 w-14" aria-hidden="true">
        <!-- Dummy element to force sidebar to shrink to fit close icon -->
      </div>
    </div>
  </div>
{/if}
