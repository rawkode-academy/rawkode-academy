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
  <Icon icon="mdi:magnify" height="28" width="28" />
</button>
