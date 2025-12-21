import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiSession } from "@/components/app-data";
import { useSession } from "@/components/session";

type NavTone = "new" | "rka" | "show" | "ask" | "submit";

const baseNavItems: Array<{ label: string; to: string; tone: NavTone }> = [
  { label: "New", to: "/", tone: "new" },
  { label: "RKA", to: "/rka", tone: "rka" },
  { label: "Show", to: "/show", tone: "show" },
  { label: "Ask", to: "/ask", tone: "ask" },
];

const navToneStyles: Record<
  NavTone,
  { active: string; hover: string; base: string }
> = {
  new: {
    base: "border-transparent bg-blue-600/15 text-blue-700",
    active: "ring-2 ring-blue-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-blue-600/25",
  },
  rka: {
    base: "border-transparent bg-emerald-600/15 text-emerald-700",
    active: "ring-2 ring-emerald-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-emerald-600/25",
  },
  show: {
    base: "border-transparent bg-violet-600/15 text-violet-700",
    active: "ring-2 ring-violet-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-violet-600/25",
  },
  ask: {
    base: "border-transparent bg-amber-600/15 text-amber-700",
    active: "ring-2 ring-amber-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-amber-600/25",
  },
  submit: {
    base: "border-transparent bg-slate-700/15 text-slate-700",
    active: "ring-2 ring-slate-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-slate-700/25",
  },
};


const navLinkClass = (tone: NavTone, isActive: boolean) =>
  cn(
    "rounded-full border px-3 py-1 transition-colors",
    navToneStyles[tone].base,
    isActive
      ? navToneStyles[tone].active
      : navToneStyles[tone].hover
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
          "flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-sm font-medium transition",
          open && "bg-muted/70"
        )}
      >
        {user.image ? (
          <img
            src={user.image}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-xs font-semibold">
            {initials || "ME"}
          </span>
        )}
        <span className="hidden max-w-[160px] truncate sm:inline">
          {displayName}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-background shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {user.email ? (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
          <div className="flex flex-col p-2 text-sm">
            <Link
              to="/profile"
              className="rounded-md px-3 py-2 text-left hover:bg-muted/70"
            >
              Profile
            </Link>
            <a
              href={signOutUrl}
              className="rounded-md px-3 py-2 text-left hover:bg-muted/70"
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
  const signInUrl = `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  const signOutUrl = `/api/auth/sign-out?returnTo=${encodeURIComponent(returnTo)}`;

  const sessionQuery = useSession();
  const user = sessionQuery.data?.user ?? null;
  const navItems = React.useMemo(
    () =>
      user
        ? [...baseNavItems, { label: "Submit", to: "/submit", tone: "submit" }]
        : baseNavItems,
    [user]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
            <Link to="/" className="flex items-center gap-3 md:justify-self-start">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <span className="font-mono text-sm">RKN</span>
              </div>
              <div className="leading-tight">
                <p className="text-lg font-semibold">Rawkode News</p>
              </div>
            </Link>

            <nav className="hidden items-center justify-center gap-4 text-sm font-medium md:flex md:w-fit md:justify-self-center">
              {navItems.slice(0, 5).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => navLinkClass(item.tone, isActive)}
                  end={item.to === "/"}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden items-center justify-end gap-3 md:flex md:justify-self-end">
              {user ? (
                <ProfileMenu user={user} signOutUrl={signOutUrl} />
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
              className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground/80 transition hover:bg-secondary md:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-border/70 bg-secondary/40 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-sm font-medium">
              <div className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "whitespace-nowrap rounded-full border px-3 py-1",
                        navToneStyles[item.tone].base,
                        isActive
                          ? navToneStyles[item.tone].active
                          : navToneStyles[item.tone].hover
                      )
                    }
                    end={item.to === "/"}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
              {user ? (
                <>
                  <NavLink
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full px-3 py-1 text-sm font-medium text-foreground/70 hover:bg-secondary/40"
                  >
                    Profile
                  </NavLink>
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    onClick={() => setMenuOpen(false)}
                  >
                    <a href={signOutUrl}>Sign out</a>
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                  onClick={() => setMenuOpen(false)}
                >
                  <a href={signInUrl}>Sign in</a>
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
          <Outlet />
        </div>
      </div>

      <footer className="border-t border-border bg-background/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span className="text-xs text-muted-foreground">
            powered by{" "}
            <a
              href="https://rawkode.academy"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Rawkode Academy
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
