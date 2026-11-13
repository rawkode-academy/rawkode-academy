export const newsSourceTypes = ["rss", "bluesky"] as const;
export type NewsSourceType = (typeof newsSourceTypes)[number];

const newsCandidateStatuses = [
  "pending",
  "converted",
  "dismissed",
] as const;
export type NewsCandidateStatus = (typeof newsCandidateStatuses)[number];

export type ApiNewsSource = {
  id: string;
  type: NewsSourceType;
  name: string;
  locator: string;
  enabled: boolean;
  lastPulledAt: string | null;
  lastPullStatus: "success" | "error" | null;
  lastPullMessage: string | null;
  lastPullCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiNewsSourcePreviewItem = {
  title: string;
  url: string;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: string | null;
};

export type ApiNewsCandidate = {
  id: string;
  url: string;
  originalUrl: string;
  title: string;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: string | null;
  status: NewsCandidateStatus;
  convertedPostId: string | null;
  latestSourceId: string | null;
  latestSourceName: string | null;
  latestSourceType: NewsSourceType | null;
  firstSeenAt: string;
  lastSeenAt: string;
  mentionCount: number;
  sourceIds: string[];
};
