import { hash } from "./domain.ts";

// Bump when the template's wording or layout changes: a new version re-plans every video.
export const TEMPLATE_VERSION = 2;
// The footer starts at this line. The site owns the whole description, so the
// marker only identifies the footer in a description we generated.
export const MARKER = "──── Rawkode Academy ────";
export const MAX_TITLE = 100;
export const MAX_DESCRIPTION_BYTES = 5000;

export type TextField = "title" | "description";
export type Field = TextField | "thumbnail";
export const TEXT_FIELDS: TextField[] = ["title", "description"];
export const ALL_FIELDS: Field[] = ["title", "description", "thumbnail"];

// The writable part of a video's snippet. videos.update replaces the whole
// snippet, so a managed update always starts from the live one.
export type Snippet = { title: string; description: string; categoryId: string; tags?: string[]; defaultLanguage?: string };
export type Managed = Partial<Record<TextField, string>>;
export type Chapter = { startTime: number; title: string };
// description is the Markdown the website renders for the video.
export type Show = { id: string; name: string };
export type Person = { id: string; name: string; x?: string; bluesky?: string; linkedin?: string };
export type Technology = { id: string; name: string; website?: string; x?: string; bluesky?: string; mastodon?: string; youtube?: string };
/** What a collaborating company asks viewers to know, written by them in the partner portal. */
export type Announcement = { name: string; text: string; url?: string };
export type AcademyVideo = { id: string; title: string; slug: string; collaborators: string[]; announcements?: Announcement[]; description: string; chapters: Chapter[]; thumbnailUrl: string; show: Show | null; course?: string | null; guests: Person[]; hosts?: Person[]; technologies: Technology[] };

export function parseFields(value: string | undefined): Field[] {
  const wanted = (value ?? ALL_FIELDS.join(",")).split(",").map(item => item.trim()).filter(Boolean);
  const unknown = wanted.filter(item => !(ALL_FIELDS as string[]).includes(item));
  if (unknown.length || !wanted.length) throw new Error(`MANAGED_FIELDS must list ${ALL_FIELDS.join(", ")}; got "${value}"`);
  return wanted as Field[];
}
export const textFields = (fields: readonly Field[]): TextField[] => TEXT_FIELDS.filter(field => fields.includes(field));

// Keep only the writable snippet fields from a videos.list item.
export function writableSnippet(raw: Partial<Snippet> | undefined): Snippet {
  const snippet: Snippet = { title: String(raw?.title ?? ""), description: String(raw?.description ?? ""), categoryId: String(raw?.categoryId ?? "") };
  if (Array.isArray(raw?.tags)) snippet.tags = raw.tags.map(String);
  if (typeof raw?.defaultLanguage === "string") snippet.defaultLanguage = raw.defaultLanguage;
  return snippet;
}

const encoder = new TextEncoder();
const byteLength = (value: string) => encoder.encode(value).length;
const stripAngles = (value: string) => value.replace(/[<>]/g, "");

// The site's Markdown description as plain text for YouTube, which shows no markup.
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\\n/g, "\n").replace(/\r\n/g, "\n")
    .replace(/^```.*$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, text: string, url: string) => (text.trim() === url ? url : `${text} (${url})`))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

// YouTube only makes chapters of a list that starts at 0:00, has at least three
// entries and keeps each at least ten seconds long. A list that starts later gets
// an "Intro" at 0:00; a list that still isn't valid is omitted.
export function renderChapters(chapters: readonly Chapter[]): string {
  const sorted = [...chapters].filter(c => c.title.trim()).sort((a, b) => a.startTime - b.startTime);
  if (sorted.length && sorted[0].startTime >= 10) sorted.unshift({ startTime: 0, title: "Intro" });
  const valid = sorted.length >= 3 && sorted[0].startTime === 0 && sorted.every((c, i) => i === 0 || c.startTime - sorted[i - 1].startTime >= 10);
  return valid ? ["Chapters", ...sorted.map(c => `${clock(c.startTime)} ${stripAngles(c.title.trim())}`)].join("\n") : "";
}

const SITE = "https://rawkode.academy";
// Every link is https. An http link is upgraded, a bare handle is expanded, anything else is dropped.
export function https(value: string | null | undefined, handleBase?: string): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^https:\/\//i.test(text)) return text;
  if (/^http:\/\//i.test(text)) return `https://${text.slice(7)}`;
  if (handleBase && /^@?[A-Za-z0-9_.-]+$/.test(text)) return `${handleBase}${text.replace(/^@/, "")}`;
  return undefined;
}
const MAX_GUESTS = 6;
const MAX_TECHNOLOGIES = 8;
const MAX_HASHTAGS = 3;

// "https://youtube.com/@handle" becomes "@handle", which YouTube links and shows as a channel card.
const youtubeHandle = (url: string | undefined) => url?.match(/^https:\/\/(?:www\.)?youtube\.com\/(@[A-Za-z0-9_.-]+)\/?$/i)?.[1];
// YouTube renders *text* as bold in descriptions. It fails (and shows the
// asterisks) when a marker touches punctuation, so a name containing any is left plain.
const bold = (name: string) => { const text = stripAngles(name); return /^[\p{L}\p{N}][\p{L}\p{N} ]*[\p{L}\p{N}]$|^[\p{L}\p{N}]$/u.test(text) ? `*${text}*` : text; };
const line = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

// The site's show, guests and technologies: one compact line each, with https
// links so YouTube links them. Socials beyond one per guest, and a technology's
// website and X, stay on the site pages.
export function renderMetadata(video: Pick<AcademyVideo, "show" | "guests" | "technologies"> & { hosts?: Person[] }): string {
  const sections: string[] = [];
  if (video.show) sections.push(`🎬 ${bold(video.show.name)} · ${SITE}/shows/${video.show.id}`);
  if (video.hosts?.length) sections.push(["🎙 *Hosts*", ...video.hosts.slice(0, MAX_GUESTS).map(host => line([stripAngles(host.name), `${SITE}/people/${host.id}`, host.x ?? host.bluesky ?? host.linkedin]))].join("\n"));
  if (video.guests.length) sections.push(["👥 *Guests*", ...video.guests.slice(0, MAX_GUESTS).map(guest => line([stripAngles(guest.name), `${SITE}/people/${guest.id}`, guest.x ?? guest.bluesky ?? guest.linkedin]))].join("\n"));
  if (video.technologies.length) sections.push(["🧩 *Technologies*", ...video.technologies.slice(0, MAX_TECHNOLOGIES).map(tech => line([stripAngles(tech.name), `${SITE}/technology/${tech.id}`, youtubeHandle(tech.youtube)]))].join("\n"));
  return sections.join("\n\n");
}

// Up to three hashtags for discovery (YouTube shows the first three above the title): the show, then the technologies.
export function renderHashtags(video: Pick<AcademyVideo, "show" | "technologies">): string {
  const tags: string[] = [];
  for (const name of [video.show?.name, ...video.technologies.map(t => t.name)]) {
    const tag = (name ?? "").replace(/[^\p{L}\p{N}]/gu, "");
    if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  return tags.slice(0, MAX_HASHTAGS).map(t => `#${t}`).join(" ");
}

export const watchUrl = (video: Pick<AcademyVideo, "slug">) => `https://rawkode.academy/watch/${video.slug}?utm_source=youtube&utm_medium=description`;
export const renderHeader = (video: Pick<AcademyVideo, "slug">) => `Get this video's free resources at ${watchUrl(video)}`;

export function renderFooter(video: Pick<AcademyVideo, "collaborators" | "announcements"> & Partial<Pick<AcademyVideo, "show" | "technologies">>): string {
  const lines = [
    MARKER,
    "Newsletter: https://rawkode.academy/#join",
    "Support the Academy: https://rawkode.academy/organizations/support-our-work?utm_source=youtube&utm_medium=description",
  ];
  if (video.collaborators.length) lines.push(`Made in collaboration with ${video.collaborators.join(" and ")}.`);
  for (const a of video.announcements ?? []) lines.push(`${a.name}: ${a.text.replace(/\s+/g, " ")}${a.url ? ` ${a.url}` : ""}`);
  const hashtags = renderHashtags({ show: video.show ?? null, technologies: video.technologies ?? [] });
  return hashtags ? `${lines.join("\n")}\n\n${hashtags}` : lines.join("\n");
}

// Cuts at a paragraph, else a sentence, else a word: never mid-word.
export function trimToBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text;
  const room = max - byteLength("…");
  if (room <= 0) return "";
  let cut = new TextDecoder().decode(encoder.encode(text).slice(0, room)).replace(/\uFFFD+$/, "");
  const atBoundary = text.slice(cut.length, cut.length + 1);
  if (!/\s/.test(atBoundary)) {
    const paragraph = cut.lastIndexOf("\n\n");
    const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    const word = cut.search(/\s\S*$/);
    const point = paragraph > cut.length * 0.4 ? paragraph : sentence > cut.length * 0.6 ? sentence + 1 : word;
    if (point > 0) cut = cut.slice(0, point);
  }
  return `${cut.replace(/\s+$/, "")}…`;
}

// The whole YouTube description: header, the site's description, chapters, the
// show, guests and technologies, then the footer. The body is trimmed first, then
// the chapters are dropped, and only then the metadata is shortened.
export function composeDescription(video: AcademyVideo): string {
  const header = renderHeader(video);
  const footer = renderFooter(video);
  const body = markdownToText(video.description);
  let chapters = renderChapters(video.chapters);
  let metadata = renderMetadata(video);
  const room = () => MAX_DESCRIPTION_BYTES - byteLength([header, chapters, metadata, footer].filter(Boolean).join("\n\n")) - 6;
  if (room() < 300) chapters = "";
  if (room() < 0) metadata = trimToBytes(metadata, Math.max(0, byteLength(metadata) + room() - 1)).replace(/\n[^\n]*…$/, "");
  const trimmed = trimToBytes(body, Math.max(0, room()));
  return [trimmed, header, chapters, metadata, footer].filter(Boolean).join("\n\n");
}

// YouTube has no shows or courses, so the title carries its context as a
// suffix: " | Show" for an episode, " | Course" for a course video. The suffix
// is kept whole; the site title is cut at a word to make room, within YouTube's
// 100 characters.
const MAX_SUFFIX = 40;

function cutAtWord(text: string, max: number): string {
  if ([...text].length <= max) return text;
  const cut = [...text].slice(0, max - 1).join("");
  const word = cut.search(/\s\S*$/);
  return `${(word > 0 ? cut.slice(0, word) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

// A show or course name is the only thing the YouTube title is ever changed for.
export function hasTitleContext(video: { show?: Show | null; course?: string | null }): boolean {
  return Boolean(stripAngles(video.show?.name ?? video.course ?? "").replace(/\s+/g, " ").trim());
}

export function composeTitle(video: Pick<AcademyVideo, "title"> & { show?: Show | null; course?: string | null }): string {
  const title = stripAngles(video.title).replace(/\s+/g, " ").trim();
  const context = stripAngles(video.show?.name ?? video.course ?? "").replace(/\s+/g, " ").trim();
  if (!context) return cutAtWord(title, MAX_TITLE);
  const suffix = ` | ${cutAtWord(context, MAX_SUFFIX)}`;
  if (title.toLowerCase().endsWith(suffix.toLowerCase())) return cutAtWord(title, MAX_TITLE);
  return `${cutAtWord(title, MAX_TITLE - [...suffix].length)}${suffix}`;
}

// The managed values the site wants, for the managed text fields only.
export function desiredManaged(video: AcademyVideo, fields: readonly Field[]): Managed {
  const managed: Managed = {};
  if (fields.includes("title")) managed.title = composeTitle(video);
  if (fields.includes("description")) managed.description = composeDescription(video);
  return managed;
}

export function validateManaged(managed: Managed): string[] {
  const errors: string[] = [];
  if (managed.title !== undefined && !managed.title.trim()) errors.push("title is empty");
  if (managed.description !== undefined && byteLength(managed.description) > MAX_DESCRIPTION_BYTES) errors.push(`description is over ${MAX_DESCRIPTION_BYTES} bytes`);
  return errors;
}

export function pickManaged(snippet: Snippet, fields: readonly TextField[]): Managed {
  return Object.fromEntries(fields.map(field => [field, snippet[field]])) as Managed;
}

export function withManaged(live: Snippet, managed: Managed): Snippet {
  return { ...live, ...managed };
}

export function managedHash(managed: Managed): Promise<string> {
  return hash(JSON.stringify(Object.entries(managed).sort(([a], [b]) => a.localeCompare(b))));
}

export type FieldHashes = Record<TextField, string>;
// Hash of every managed-capable field, so a later change to MANAGED_FIELDS
// compares against a baseline that already covers the new field.
export async function fieldHashes(snippet: Snippet): Promise<FieldHashes> {
  return { title: await hash(snippet.title), description: await hash(snippet.description) };
}
