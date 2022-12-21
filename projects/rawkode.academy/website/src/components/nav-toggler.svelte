<script lang="ts">
  import Icon from "@iconify/svelte";
  import { isOpen } from "@components/navigation/store";

  const toggleMenu = () => {
    isOpen.set(!$isOpen);
  };
</script>

<button
  type="button"
  on:click={toggleMenu}
  class="nav-toggler"
>
  <span class="sr-only">Open sidebar</span>
  <Icon icon="mdi:menu" class="w-7 h-7" />
</button>
