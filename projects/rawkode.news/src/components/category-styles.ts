import type { FeedCategory } from "@/components/app-data";

export const categoryTone = {
  new: {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    text: "text-slate-700",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-slate-300 hover:bg-slate-100/80",
    ring: "ring-primary/35",
  },
  rka: {
    badge: "border-emerald-200 bg-emerald-100/70 text-emerald-800",
    text: "text-emerald-800",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-emerald-300 hover:bg-emerald-100/70",
    ring: "ring-primary/35",
  },
  show: {
    badge: "border-indigo-200 bg-indigo-100/70 text-indigo-800",
    text: "text-indigo-800",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-indigo-300 hover:bg-indigo-100/70",
    ring: "ring-primary/35",
  },
  ask: {
    badge: "border-amber-200 bg-amber-100/80 text-amber-800",
    text: "text-amber-800",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-amber-300 hover:bg-amber-100/80",
    ring: "ring-primary/35",
  },
  announce: {
    badge: "border-rose-200 bg-rose-100/70 text-rose-800",
    text: "text-rose-800",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-rose-300 hover:bg-rose-100/70",
    ring: "ring-primary/35",
  },
  links: {
    badge: "border-cyan-200 bg-cyan-100/70 text-cyan-800",
    text: "text-cyan-800",
    active: "border-primary/35 bg-primary/10 text-foreground",
    hover: "hover:border-cyan-300 hover:bg-cyan-100/70",
    ring: "ring-primary/35",
  },
} as const satisfies Record<
  FeedCategory,
  { badge: string; text: string; active: string; hover: string; ring: string }
>;

export const getCategoryBadgeClass = (category: FeedCategory) =>
  categoryTone[category]?.badge ?? categoryTone.new.badge;

export const getCategoryTabClass = (category: FeedCategory, isActive: boolean) => {
  const tone = categoryTone[category] ?? categoryTone.new;
  return isActive ? tone.active : `text-muted-foreground ${tone.hover}`;
};

export const getCategoryRingClass = (category: FeedCategory) =>
  categoryTone[category]?.ring ?? categoryTone.new.ring;

export const getCategoryTextClass = (category: FeedCategory) =>
  categoryTone[category]?.text ?? categoryTone.new.text;
