export const menuItems = [
    {
        title: "Home",
        exact: true,
        href: "/",
        icon: "material-symbols:home",
        regex: /^\/$/,
    },
    {
      title: "Services",
      exact: true,
      href: "/services",
      icon: "material-symbols:info",
      regex: /^\/services$/,
    },
    {
        title: "Shows",
        exact: false,
        href: "/shows",
        icon: "material-symbols:tv-outline",
        regex: /^\/shows$/,
    },
    {
        title: "Community",
        exact: false,
        href: "https://community.rawkode.academy",
        icon: "material-symbols:group",
        // Not used, but stops community getting underlined or marked as active
        regex: /^\/community$/,
        target: "_blank",
    },
    {
        title: "Let's Collaborate",
        exact: false,
        href: "/work-together",
        icon: "material-symbols:handshake",
        regex: /^\/work-together$/,
    },
];
