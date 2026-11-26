import { type AcademyVideo, desiredManaged, type Field, type FieldHashes, fieldHashes, type Managed, managedHash, pickManaged, type Snippet, validateManaged } from "./render.ts";

export type Status = "NOOP" | "CHANGE" | "DRIFT" | "SKIP" | "ERROR";
export type FieldDiff = { field: Field; before: string; after: string };
export type PlanItem = {
  youtubeId: string;
  academyId: string | null;
  slug: string | null;
  status: Status;
  reason: string | null;
  liveHash: string | null;
  desired: Managed | null;
  diff: FieldDiff[];
};

export type ClassifyInput = {
  youtubeId: string;
  academy: AcademyVideo | undefined;
  live: Snippet | undefined;
  // Hashes of the fields as we last pushed or first saw them; undefined on first sight.
  base: FieldHashes | undefined;
  fields: readonly Field[];
};

const skip = (input: ClassifyInput, reason: string): PlanItem => ({ youtubeId: input.youtubeId, academyId: input.academy?.id ?? null, slug: input.academy?.slug ?? null, status: "SKIP", reason, liveHash: null, desired: null, diff: [] });

// One video's state. The rules: nothing differs, NOOP; the live fields are
// still what we last pushed (or first saw), CHANGE; someone edited them in
// Studio since, DRIFT, which is reported and never overwritten by default.
export async function classify(input: ClassifyInput): Promise<PlanItem & { adopt?: FieldHashes }> {
  if (!input.academy) return skip(input, "no listed Academy video (course-only, unpublished or unmapped)");
  if (!input.live) return skip(input, "not found on YouTube (private or deleted)");
  const live = pickManaged(input.live, input.fields);
  const desired = desiredManaged(input.live, input.academy, input.fields);
  const base = { youtubeId: input.youtubeId, academyId: input.academy.id, slug: input.academy.slug };
  const errors = validateManaged(desired);
  const liveHash = await managedHash(live);
  const liveFields = await fieldHashes(input.live);
  if (errors.length) return { ...base, status: "ERROR", reason: errors.join("; "), liveHash, desired: null, diff: [] };
  const diff = input.fields.flatMap((field): FieldDiff[] => desired[field] !== live[field] ? [{ field, before: live[field] ?? "", after: desired[field] ?? "" }] : []);
  if (!diff.length) return { ...base, status: "NOOP", reason: null, liveHash, desired, diff, adopt: liveFields };
  if (input.base === undefined) return { ...base, status: "CHANGE", reason: "first run: live values adopted as the baseline", liveHash, desired, diff, adopt: liveFields };
  if (input.fields.every(field => input.base![field] === liveFields[field])) return { ...base, status: "CHANGE", reason: null, liveHash, desired, diff };
  return { ...base, status: "DRIFT", reason: "edited in Studio since the last sync; applying needs an explicit override", liveHash, desired, diff };
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
    ...(["CHANGE", "DRIFT", "ERROR", "SKIP", "NOOP"] as Status[]).map(status => `| ${status} | ${counts.get(status) ?? 0} |`),
    "",
  ];
  for (const status of ["DRIFT", "ERROR", "CHANGE"] as Status[]) {
    const group = items.filter(item => item.status === status);
    if (!group.length) continue;
    out.push(`## ${status} (${group.length})`, "");
    for (const item of group) {
      out.push(`### ${item.slug ?? item.youtubeId} (https://youtu.be/${item.youtubeId})`, "");
      if (item.reason) out.push(item.reason, "");
      for (const change of item.diff) out.push(`**${change.field}** before:`, "", quote(clip(change.before)), "", "after:", "", quote(clip(change.after)), "");
    }
  }
  const skipped = items.filter(item => item.status === "SKIP");
  if (skipped.length) out.push(`## SKIP (${skipped.length})`, "", ...skipped.map(item => `- ${item.slug ?? item.youtubeId}: ${item.reason}`), "");
  return out.join("\n");
}
