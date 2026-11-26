import { hash } from "./domain.ts";

// Bump when the footer's wording or links change: a new version re-plans every video.
export const TEMPLATE_VERSION = 1;
// Everything from this line to the end of the description belongs to the site.
// Anything above it is written in Studio and is never touched.
export const MARKER = "──── Rawkode Academy ────";
export const MAX_TITLE = 100;
export const MAX_DESCRIPTION_BYTES = 5000;

export type Field = "title" | "description";
export const ALL_FIELDS: Field[] = ["title", "description"];

// The writable part of a video's snippet. videos.update replaces the whole
// snippet, so a managed update always starts from the live one.
export type Snippet = { title: string; description: string; categoryId: string; tags?: string[]; defaultLanguage?: string };
export type Managed = Partial<Record<Field, string>>;
export type AcademyVideo = { id: string; title: string; slug: string; collaborators: string[] };

export function parseFields(value: string | undefined): Field[] {
  const wanted = (value ?? "description").split(",").map(item => item.trim()).filter(Boolean);
  const unknown = wanted.filter(item => !(ALL_FIELDS as string[]).includes(item));
  if (unknown.length || !wanted.length) throw new Error(`MANAGED_FIELDS must list ${ALL_FIELDS.join(", ")}; got "${value}"`);
  return wanted as Field[];
}

// Keep only the writable snippet fields from a videos.list item.
export function writableSnippet(raw: Partial<Snippet> | undefined): Snippet {
  const snippet: Snippet = { title: String(raw?.title ?? ""), description: String(raw?.description ?? ""), categoryId: String(raw?.categoryId ?? "") };
  if (Array.isArray(raw?.tags)) snippet.tags = raw.tags.map(String);
  if (typeof raw?.defaultLanguage === "string") snippet.defaultLanguage = raw.defaultLanguage;
  return snippet;
}

// The description written in Studio, without the site's footer.
export function descriptionBody(description: string): string {
  const lines = description.replace(/\r\n/g, "\n").split("\n");
  const marker = lines.findIndex(line => line.trim() === MARKER);
  return (marker === -1 ? lines : lines.slice(0, marker)).join("\n").replace(/\s+$/, "");
}

export function renderFooter(video: Pick<AcademyVideo, "slug" | "collaborators">): string {
  const lines = [
    MARKER,
    `Watch with chapters, code and resources: https://rawkode.academy/watch/${video.slug}?utm_source=youtube&utm_medium=description`,
    "Newsletter: https://rawkode.academy/#join",
    "Support the Academy: https://rawkode.academy/organizations/support-our-work?utm_source=youtube&utm_medium=description",
  ];
  if (video.collaborators.length) lines.push(`Made in collaboration with ${video.collaborators.join(" and ")}.`);
  return lines.join("\n");
}

export function composeDescription(live: string, video: AcademyVideo): string {
  const body = descriptionBody(live);
  return (body ? `${body}\n\n` : "") + renderFooter(video);
}

// The managed values the site wants, for the managed fields only.
export function desiredManaged(live: Snippet, video: AcademyVideo, fields: readonly Field[]): Managed {
  const managed: Managed = {};
  if (fields.includes("title")) managed.title = video.title;
  if (fields.includes("description")) managed.description = composeDescription(live.description, video);
  return managed;
}

export function validateManaged(managed: Managed): string[] {
  const errors: string[] = [];
  if (managed.title !== undefined) {
    if (!managed.title.trim()) errors.push("title is empty");
    if ([...managed.title].length > MAX_TITLE) errors.push(`title is over ${MAX_TITLE} characters`);
    if (/[<>]/.test(managed.title)) errors.push("title contains < or >");
  }
  if (managed.description !== undefined) {
    if (new TextEncoder().encode(managed.description).length > MAX_DESCRIPTION_BYTES) errors.push(`description is over ${MAX_DESCRIPTION_BYTES} bytes`);
    if (/[<>]/.test(managed.description)) errors.push("description contains < or >");
  }
  return errors;
}

export function pickManaged(snippet: Snippet, fields: readonly Field[]): Managed {
  return Object.fromEntries(fields.map(field => [field, snippet[field]])) as Managed;
}

// Live snippet with the managed values swapped in: what videos.update sends.
export function withManaged(live: Snippet, managed: Managed): Snippet {
  return { ...live, ...managed };
}

export function managedHash(managed: Managed): Promise<string> {
  return hash(JSON.stringify(Object.entries(managed).sort(([a], [b]) => a.localeCompare(b))));
}

export type FieldHashes = Record<Field, string>;
// Hash of every managed-capable field, so a later change to MANAGED_FIELDS
// compares against a baseline that already covers the new field.
export async function fieldHashes(snippet: Snippet): Promise<FieldHashes> {
  return { title: await hash(snippet.title), description: await hash(snippet.description) };
}
