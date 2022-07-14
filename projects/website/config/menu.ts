interface MenuItem {
  title: string;
  href: string;
  icon: string;
}

export const menuItems: MenuItem[] = [
  {
    title: "Home",
    href: "/",
    icon: "mdi-light:home",
  },
  {
    title: "Shows",
    href: "/shows/",
    icon: "mdi-light:home",
  },
  {
    title: "Contact",
    href: "/contact/",
    icon: "mdi-light:home",
  },
];
