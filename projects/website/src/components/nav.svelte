<script lang="ts">
  import { isOpen } from "@components/sidebar/store";

  const toggleMenu = () => {
    console.log(`Setting isOpen to ${!$isOpen}`);
    isOpen.set(!$isOpen);
  };

  const showCommandPalette = () => {
    const ninja = document.querySelector("ninja-keys");
    ninja.open();
  };
</script>

<div class="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
  <button
    type="button"
    on:click={toggleMenu}
    class="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
  >
    <span class="sr-only">Open sidebar</span>
    <!-- Heroicon name: outline/menu-alt-2 -->
    <svg
      class="h-6 w-6"
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
        d="M4 6h16M4 12h16M4 18h7"
      />
    </svg>
  </button>

  <div class="flex-1 px-4 flex justify-between">
    <div class="flex-1 flex">
      <div class="w-full flex text-center md:ml-0">
        <div
          class="relative w-full text-gray-400 focus-within:text-gray-600"
          on:click={showCommandPalette}
        >
          <div
            class="absolute w-full inset-y-0 left-0 flex items-center pointer-events-none"
          >
            <input
              id="search-field"
              class="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm"
              placeholder="Click to open the command palette ..."
              type="search"
              name="search"
            />
          </div>
        </div>
      </div>
    </div>
    <!-- <div class="ml-4 flex items-center md:ml-6">Right</div> -->
  </div>
</div>
