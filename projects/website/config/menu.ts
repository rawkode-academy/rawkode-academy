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
    icon: "mdi-light:home",
    regex: /^\/$/,
  },
  {
    title: "Shows",
    exact: false,
    href: "/shows",
    icon: "mdi-light:home",
    regex: /^\/shows$/,
  },{
    title: "Prices",
    exact: false,
    href: "/pricing",
    icon: "mdi-light:home",
    regex: /^\/pricing$/,
  },
  {
    title: "Contact",
    exact: false,
    href: "/contact",
    icon: "mdi-light:home",
    regex: /^\/contact$/,
  },
];
