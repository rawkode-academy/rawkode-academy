<script>
  import { NinjaKeys } from "ninja-keys";
  import { onMount } from "svelte";

  const hotkeys = [
    {
      id: "Home",
      title: "Home",
      mdIcon: "home",
      handler: () => {
        window.location.assign("/");
      },
    },
    {
      id: "Services",
      title: "Services",
      mdIcon: "info",
      handler: () => {
        window.location.assign("/services");
      },
    },
    {
      id: "Shows",
      title: "Shows",
      mdIcon: "tv",
      handler: () => {
        window.location.assign("/shows");
      },
    },
    {
      id: "Community",
      title: "Community",
      mdIcon: "group",
      handler: () => {
        window.open('https://community.rawkode.academy', '_blank');
      },
    },
    {
      id: "Let's Collaborate",
      title: "Let's Collaborate",
      mdIcon: "handshake",
      handler: () => {
        window.location.assign("/work-together");
      },
    },
  ];

  onMount(async () => {
    const ninja = document.querySelector("ninja-keys");
    ninja.data = hotkeys;
  });

  function handleSelected(event) {
    // (Optional) component-wide selected event
    // useful to handle if no action found
    // detail = { search: '...', action: NinjaAction | undefined }
    // so on empty action you can perform API search or etc
    console.log("handleSelected", event.detail);
  }
</script>

<ninja-keys
  on:selected={handleSelected}
  placeholder="What would you like to do?"
/>
