import { type AcademyVideo, desiredManaged, type Field, type FieldHashes, fieldHashes, type Managed, managedHash, pickManaged, type Snippet, textFields, validateManaged } from "./render.ts";

// The site owns the video, so a difference is always a CHANGE; there is no drift.
export type Status = "NOOP" | "CHANGE" | "SKIP" | "ERROR";
export type FieldDiff = { field: "title" | "description"; before: string; after: string };
export type ThumbnailPlan = { url: string; tag: string; changed: boolean };
export type PlanItem = {
  youtubeId: string;
  academyId: string | null;
  slug: string | null;
  status: Status;
  reason: string | null;
  liveHash: string | null;
  desired: Managed | null;
  diff: FieldDiff[];
  thumbnail: ThumbnailPlan | null;
};

export type ClassifyInput = {
  youtubeId: string;
  academy: AcademyVideo | undefined;
  live: Snippet | undefined;
  // Hashes of the fields as we last pushed or first saw them; undefined on first sight.
  base: FieldHashes | undefined;
  fields: readonly Field[];
  // Tag of the source image now, and of the one we last pushed (undefined: never).
  thumbnailTag?: string | null;
  pushedThumbnailTag?: string | null;
};

const skip = (input: ClassifyInput, reason: string): PlanItem => ({ youtubeId: input.youtubeId, academyId: input.academy?.id ?? null, slug: input.academy?.slug ?? null, status: "SKIP", reason, liveHash: null, desired: null, diff: [], thumbnail: null });

// One video's state: nothing differs, NOOP; otherwise CHANGE. A change over a
// live value someone edited in Studio is still a CHANGE, with the reason noting it.
export async function classify(input: ClassifyInput): Promise<PlanItem & { adopt?: FieldHashes }> {
  if (!input.academy) return skip(input, "no listed Academy video (course-only, unpublished or unmapped)");
  if (!input.live) return skip(input, "not found on YouTube (private or deleted)");
  const textual = textFields(input.fields);
  const live = pickManaged(input.live, textual);
  const desired = desiredManaged(input.academy, input.fields);
  const base = { youtubeId: input.youtubeId, academyId: input.academy.id, slug: input.academy.slug };
  const errors = validateManaged(desired);
  const liveHash = await managedHash(live);
  const liveFields = await fieldHashes(input.live);
  const thumbnail: ThumbnailPlan | null = input.fields.includes("thumbnail") && input.thumbnailTag && input.academy.thumbnailUrl ? { url: input.academy.thumbnailUrl, tag: input.thumbnailTag, changed: input.thumbnailTag !== input.pushedThumbnailTag } : null;
  if (errors.length) return { ...base, status: "ERROR", reason: errors.join("; "), liveHash, desired: null, diff: [], thumbnail: null };
  const diff = textual.flatMap((field): FieldDiff[] => desired[field] !== live[field] ? [{ field, before: live[field] ?? "", after: desired[field] ?? "" }] : []);
  if (!diff.length && !thumbnail?.changed) return { ...base, status: "NOOP", reason: null, liveHash, desired, diff, thumbnail, adopt: liveFields };
  const studioEdit = input.base !== undefined && diff.length > 0 && !textual.every(field => input.base![field] === liveFields[field]);
  const reason = input.base === undefined ? "first run: live values adopted as the baseline" : studioEdit ? "overwrites an edit made in Studio since the last sync" : null;
  return { ...base, status: "CHANGE", reason, liveHash, desired, diff, thumbnail, ...(input.base === undefined ? { adopt: liveFields } : {}) };
}

const clip = (value: string, max = 400) => (value.length > max ? `${value.slice(0, max)}… (${value.length} chars)` : value);
const quote = (value: string) => value.split("\n").map(line => `    ${line}`).join("\n");

export function renderReport(plan: { id: string; createdAt: string; templateVersion: number; fields: string[] }, items: PlanItem[]): string {
  const counts = new Map<Status, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const out = [
    `# YouTube sync plan ${plan.id}`,
    "",
    `Created ${plan.createdAt}. Template v${plan.templateVersion}. Managed fields: ${plan.fields.join(", ")}.`,
    "",
    "| Status | Videos |", "| --- | ---: |",
    ...(["CHANGE", "ERROR", "SKIP", "NOOP"] as Status[]).map(status => `| ${status} | ${counts.get(status) ?? 0} |`),
    "",
  ];
  for (const status of ["ERROR", "CHANGE"] as Status[]) {
    const group = items.filter(item => item.status === status);
    if (!group.length) continue;
    out.push(`## ${status} (${group.length})`, "");
    for (const item of group) {
      out.push(`### ${item.slug ?? item.youtubeId} (https://youtu.be/${item.youtubeId})`, "");
      if (item.reason) out.push(item.reason, "");
      if (item.thumbnail?.changed) out.push(`**thumbnail** new: ${item.thumbnail.url} (converted to JPEG on apply)`, "");
      for (const change of item.diff) out.push(`**${change.field}** before:`, "", quote(clip(change.before)), "", "after:", "", quote(clip(change.after)), "");
    }
  }
  const skipped = items.filter(item => item.status === "SKIP");
  if (skipped.length) out.push(`## SKIP (${skipped.length})`, "", ...skipped.map(item => `- ${item.slug ?? item.youtubeId}: ${item.reason}`), "");
  return out.join("\n");
}
