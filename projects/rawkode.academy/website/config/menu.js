export const menuItems = [
    {
        title: "Home",
        exact: true,
        href: "/",
        icon: "mdi:home",
        regex: /^\/$/,
    },
    {
      title: "Services",
      exact: true,
      href: "/services",
      icon: "mdi:account-box-outline",
      regex: /^\/services$/,
    },
    {
        title: "Shows",
        exact: false,
        href: "/shows",
        icon: "mdi:play-box-outline",
        regex: /^\/shows$/,
    },
    {
        title: "Let's Collaborate",
        exact: false,
        href: "/work-together",
        icon: "mdi:account-box-outline",
        regex: /^\/work-together$/,
    },
];
