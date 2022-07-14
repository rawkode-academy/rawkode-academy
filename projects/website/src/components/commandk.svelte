<script>
  import { NinjaKeys } from "ninja-keys";
  import { onMount } from "svelte";

  const hotkeys = [
    {
      id: "Home",
      title: "Open Home",
      hotkey: "cmd+h",
      mdIcon: "home",
      handler: () => {
        console.log("navigation to home");
      },
    },
    {
      id: "Open Projects",
      title: "Open Projects",
      hotkey: "cmd+p",
      mdIcon: "apps",
      handler: () => {
        console.log("navigation to projects");
      },
    },
    {
      id: "Theme",
      title: "Change theme...",
      mdIcon: "desktop_windows",
      children: [
        {
          id: "Light Theme",
          title: "Change theme to Light",
          mdIcon: "light_mode",
          handler: () => {
            console.log("theme light");
          },
        },
        {
          id: "Dark Theme",
          title: "Change theme to Dark",
          mdIcon: "dark_mode",
          keywords: "lol",
          handler: () => {
            console.log("theme dark");
          },
        },
      ],
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
