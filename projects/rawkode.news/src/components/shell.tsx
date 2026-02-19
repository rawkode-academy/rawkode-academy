import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, Menu, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiSession } from "@/components/app-data";
import { useSession } from "@/components/session";

type NavItem = { label: string; to: string };

const navItems: NavItem[] = [
  { label: "New", to: "/" },
  { label: "RKA", to: "/rka" },
  { label: "News", to: "/news" },
  { label: "Show", to: "/show" },
  { label: "Ask", to: "/ask" },
  { label: "Search", to: "/search" },
];

const desktopActionSizeClass = "h-10 min-w-36";

const navLinkClass = (isActive: boolean) =>
  cn(
    "rkn-nav-tab",
    isActive && "border-primary/35 bg-primary/10 text-foreground"
  );

function ProfileMenu({
  user,
  signOutUrl,
}: {
  user: ApiSession["user"];
  signOutUrl: string;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const location = useLocation();
  const displayName = user.name || user.email || "Profile";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-none border border-border bg-card px-3 text-sm font-medium text-foreground",
          desktopActionSizeClass,
          "hover:border-primary/35 hover:bg-accent",
          open && "border-primary/35 bg-accent"
        )}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={displayName}
            className="h-6 w-6 rounded-none object-cover"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-none bg-secondary text-[11px] font-semibold">
            {initials || "ME"}
          </span>
        )}
        <span className="hidden whitespace-nowrap sm:inline">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-72 max-w-[92vw] overflow-hidden rounded-none border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {user.email ? (
              <p className="text-xs text-muted-foreground break-all">{user.email}</p>
            ) : null}
          </div>
          <div className="p-1.5 text-sm">
            <Link
              to="/profile"
              className="block rounded-none px-3 py-2 text-foreground/80 hover:bg-accent hover:text-foreground"
            >
              Profile
            </Link>
            <a
              href={signOutUrl}
              className="block rounded-none px-3 py-2 text-foreground/80 hover:bg-accent hover:text-foreground"
            >
              Sign out
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Shell() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();
  const returnTo = React.useMemo(() => {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return next.startsWith("/") ? next : "/";
  }, [location]);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const signOutUrl = `/api/auth/sign-out?returnTo=${encodeURIComponent(returnTo)}`;
  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="rkn-shell-header sticky top-0 z-50">
        <div className="rkn-container py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 md:flex md:items-center md:gap-4">
              <Link to="/" className="inline-flex min-w-0 shrink-0 items-center gap-3">
                <div className="grid h-10 w-12 shrink-0 place-items-center rounded-none bg-primary text-xs font-semibold tracking-wide text-primary-foreground">
                  RKN
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold leading-tight">Rawkode News</p>
                </div>
              </Link>

              <nav className="hidden items-center gap-1 border-l border-border/80 pl-4 md:flex">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  <Button size="sm" className={desktopActionSizeClass} asChild>
                    <Link to="/submit" className="inline-flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Create post
                    </Link>
                  </Button>
                  <ProfileMenu user={user} signOutUrl={signOutUrl} />
                </>
              ) : (
                <Button variant="secondary" size="sm" asChild>
                  <a href={signInUrl}>Sign in</a>
                </Button>
              )}
            </div>

            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((value) => !value)}
              className="grid h-10 w-10 place-items-center rounded-none border border-border bg-card text-muted-foreground hover:bg-accent md:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-border bg-card md:hidden">
            <div className="rkn-container space-y-2 py-3">
              <div className="grid gap-1.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "inline-flex h-10 items-center rounded-none px-3 text-sm font-semibold",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>

              {user ? (
                <div className="grid gap-2 border-t border-border pt-2">
                  <Button size="sm" asChild>
                    <Link to="/submit" className="inline-flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Create post
                    </Link>
                  </Button>
                  <NavLink
                    to="/profile"
                    className="inline-flex h-10 items-center rounded-none px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Profile
                  </NavLink>
                  <Button variant="secondary" size="sm" asChild>
                    <a href={signOutUrl}>Sign out</a>
                  </Button>
                </div>
              ) : (
                <div className="border-t border-border pt-2">
                  <Button variant="secondary" size="sm" asChild>
                    <a href={signInUrl}>Sign in</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col">
        <div className="rkn-container flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>

      <footer className="border-t border-border/80 bg-background/85">
        <div className="rkn-container flex flex-wrap items-center gap-2 py-5 text-xs text-muted-foreground">
          <span>
            powered by{" "}
            <a href="https://rawkode.academy" className="font-medium text-foreground/80 hover:text-foreground">
              Rawkode Academy
            </a>
          </span>
          <span aria-hidden="true">•</span>
          <a href="/rss.xml" className="text-[11px] font-bold uppercase tracking-wide hover:text-foreground">
            RSS
          </a>
        </div>
      </footer>
    </div>
  );
}
