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
</div>
