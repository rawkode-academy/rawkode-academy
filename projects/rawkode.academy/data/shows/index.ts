import { Tables } from "../types/supabase.ts";

export const rawkodeLive: Tables<'shows'> = {
  name: "Rawkode Live",
  slug: "rawkode-live",
  draft: false,
  description: "Rawkode Live is a weekly live stream where we discuss the latest news in the cloud native ecosystem, and interview guests from the community.",
};

export const klustered: Tables<'shows'> = {
  name: "Klustered",
  slug: "klustered",
  draft: false,
  description: "Klustered is a game show where contestants test their knowledge of Kubernetes and CNCF projects.",
};
