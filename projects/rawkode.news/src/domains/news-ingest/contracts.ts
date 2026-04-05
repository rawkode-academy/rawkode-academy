export const newsSourceTypes = ["rss", "bluesky"] as const;
export type NewsSourceType = (typeof newsSourceTypes)[number];

export const newsCandidateStatuses = [
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

export type ApiNewsCandidateMention = {
  candidateId: string;
  sourceId: string;
  sourceItemUrl: string;
  sourceItemId: string | null;
  pulledAt: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

export const isApiNewsSource = (value: unknown): value is ApiNewsSource => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.type !== "string") return false;
  if (!newsSourceTypes.includes(value.type as NewsSourceType)) return false;
  if (typeof value.name !== "string") return false;
  if (typeof value.locator !== "string") return false;
  if (typeof value.enabled !== "boolean") return false;
  if (!(value.lastPulledAt === null || typeof value.lastPulledAt === "string")) return false;
  if (
    !(
      value.lastPullStatus === null ||
      value.lastPullStatus === "success" ||
      value.lastPullStatus === "error"
    )
  ) {
    return false;
  }
  if (!(value.lastPullMessage === null || typeof value.lastPullMessage === "string")) return false;
  if (typeof value.lastPullCount !== "number") return false;
  if (typeof value.createdAt !== "string") return false;
  if (typeof value.updatedAt !== "string") return false;
  return true;
};

export const isApiNewsCandidate = (value: unknown): value is ApiNewsCandidate => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.url !== "string") return false;
  if (typeof value.originalUrl !== "string") return false;
  if (typeof value.title !== "string") return false;
  if (!(value.excerpt === null || typeof value.excerpt === "string")) return false;
  if (!(value.authorName === null || typeof value.authorName === "string")) return false;
  if (!(value.publishedAt === null || typeof value.publishedAt === "string")) return false;
  if (typeof value.status !== "string") return false;
  if (!newsCandidateStatuses.includes(value.status as NewsCandidateStatus)) return false;
  if (!(value.convertedPostId === null || typeof value.convertedPostId === "string")) return false;
  if (!(value.latestSourceId === null || typeof value.latestSourceId === "string")) return false;
  if (!(value.latestSourceName === null || typeof value.latestSourceName === "string")) return false;
  if (
    !(
      value.latestSourceType === null ||
      newsSourceTypes.includes(value.latestSourceType as NewsSourceType)
    )
  ) {
    return false;
  }
  if (typeof value.firstSeenAt !== "string") return false;
  if (typeof value.lastSeenAt !== "string") return false;
  if (typeof value.mentionCount !== "number") return false;
  if (!Array.isArray(value.sourceIds) || !value.sourceIds.every((item) => typeof item === "string")) {
    return false;
  }
  return true;
};
