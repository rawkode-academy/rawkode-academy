<script lang="ts">
  import Icon from "@iconify/svelte";

  const showCommandPalette = () => {
    const ninja = document.querySelector("ninja-keys");
    ninja.open();
  };
</script>

<button
  type="button"
  on:click={showCommandPalette}
  class="toggler"
>
  <Icon icon="mdi:magnify" class="w-7 h-7" />
</button>
