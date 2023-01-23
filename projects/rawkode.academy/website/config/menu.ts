interface MenuItem {
  exact: boolean;
  title: string;
  href: string;
  icon: string;
  regex: RegExp;
}

export const menuItems: MenuItem[] = [
  {
    title: "Home",
    exact: true,
    href: "/",
    icon: "mdi:home",
    regex: /^\/$/,
  },
  // {
  //   title: "Shows",
  //   exact: false,
  //   href: "/shows",
  //   icon: "mdi:play-box-outline",
  //   regex: /^\/shows$/,
  // },
  {
    title: "Prices",
    exact: false,
    href: "/pricing",
    icon: "mdi:cash",
    regex: /^\/pricing$/,
  },
  {
    title: "Contact",
    exact: false,
    href: "/contact",
    icon: "mdi:account-box-outline",
    regex: /^\/contact$/,
  },
];
