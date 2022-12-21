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
      id: "Shows",
      title: "Shows",
      mdIcon: "attach_money",
      handler: () => {
        window.location.assign("/shows");
      },
    },
    {
      id: "Prices",
      title: "Prices",
      mdIcon: "attach_money",
      handler: () => {
        window.location.assign("/pricing");
      },
    },
    {
      id: "Contact Us",
      title: "Contact Us",
      mdIcon: "email",
      handler: () => {
        window.location.assign("/contact");
      },
    },
    {
      id: "Work Together",
      title: "Let's Work Together?",
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
