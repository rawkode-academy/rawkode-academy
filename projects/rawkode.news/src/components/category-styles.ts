import type { FeedCategory } from "@/components/app-data";

export const categoryTone = {
  new: {
    badge: "border-transparent bg-blue-600/15 text-blue-700",
    active: "text-white ring-2 ring-blue-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-blue-600/25",
    ring: "ring-blue-200",
  },
  rka: {
    badge: "border-transparent bg-emerald-600/15 text-emerald-700",
    active: "text-white ring-2 ring-emerald-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-emerald-600/25",
    ring: "ring-emerald-200",
  },
  show: {
    badge: "border-transparent bg-violet-600/15 text-violet-700",
    active: "text-white ring-2 ring-violet-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-violet-600/25",
    ring: "ring-violet-200",
  },
  ask: {
    badge: "border-transparent bg-amber-600/15 text-amber-700",
    active: "text-white ring-2 ring-amber-200 ring-offset-2 ring-offset-background",
    hover: "hover:bg-amber-600/25",
    ring: "ring-amber-200",
  },
} as const satisfies Record<
  FeedCategory,
  { badge: string; active: string; hover: string; ring: string }
>;

export const getCategoryBadgeClass = (category: FeedCategory) =>
  categoryTone[category]?.badge ?? categoryTone.new.badge;

export const getCategoryTabClass = (category: FeedCategory, isActive: boolean) => {
  const tone = categoryTone[category] ?? categoryTone.new;
  return isActive
    ? tone.active
    : `text-foreground/70 ${tone.hover}`;
};

export const getCategoryRingClass = (category: FeedCategory) =>
  categoryTone[category]?.ring ?? categoryTone.new.ring;
