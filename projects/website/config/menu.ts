interface MenuItem {
  exact: boolean;
  title: string;
  href: string;
  icon: string;
}

export const menuItems: MenuItem[] = [
  {
    title: "Home",
    exact: true,
    href: "/#",
    icon: "mdi-light:home",
  },
  {
    title: "Shows",
    exact: false,
    href: "/shows",
    icon: "mdi-light:home",
  },
  {
    title: "Contact",
    exact: false,
    href: "/contact",
    icon: "mdi-light:home",
  },
];
