<script lang="ts">
  import { isOpen } from "@components/sidebar/store";

  const toggleMenu = () => {
    isOpen.set(!$isOpen);
  };
</script>

<button
  type="button"
  on:click={toggleMenu}
  class="toggler"
>
  <span class="sr-only">Open sidebar</span>
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
