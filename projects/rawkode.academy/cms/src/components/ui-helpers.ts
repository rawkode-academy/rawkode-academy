// Pure helpers for the admin UI: patch computation, diffs, issue mapping and
// value conversions. No DOM or React here, so they are unit tested directly.
import type { FieldDescriptor } from "@rawkodeacademy/content-write";

export type Row = Record<string, unknown>;

export interface Issue {
	path: string;
	message: string;
}

// ---------------------------------------------------------------- equality

/** Structural equality for JSON-like values (object key order ignored). */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (
		a === null ||
		b === null ||
		typeof a !== "object" ||
		typeof b !== "object"
	) {
		// undefined and null are the same "no value" for form purposes.
		return (a ?? null) === (b ?? null);
	}
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		return (
			a.length === b.length && a.every((value, i) => deepEqual(value, b[i]))
		);
	}
	const left = a as Row;
	const right = b as Row;
	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const key of keys) {
		if (!deepEqual(left[key], right[key])) return false;
	}
	return true;
}

// ----------------------------------------------------------------- patches

/** The fields of `draft` that differ from `original`. */
export function computePatch(original: Row, draft: Row): Row {
	const patch: Row = {};
	for (const [key, value] of Object.entries(draft)) {
		if (!deepEqual(original[key], value))
			patch[key] = value === undefined ? null : value;
	}
	return patch;
}

const isEmpty = (value: unknown) =>
	value === undefined ||
	value === null ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/**
 * The data for creating a row: every field the editor set. Empty values are
 * left out so the write model applies its defaults, except booleans and the
 * empty lists of required list fields (a course with no authors yet).
 */
export function createPayload(draft: Row, fields: FieldDescriptor[]): Row {
	const data: Row = {};
	for (const field of fields) {
		const value = draft[field.name];
		if (typeof value === "boolean") data[field.name] = value;
		else if (Array.isArray(value) && field.required) data[field.name] = value;
		else if (!isEmpty(value)) data[field.name] = value;
	}
	return data;
}

/**
 * Values for hidden fields a new row still needs: required text fields with
 * no default (a technology's derived description) are sent as "", as the
 * importers do, so the write model's derive step fills them in.
 */
export function hiddenCreateDefaults(
	fields: FieldDescriptor[],
	hidden: string[],
): Row {
	const data: Row = {};
	for (const field of fields) {
		if (
			hidden.includes(field.name) &&
			field.type === "text" &&
			field.required &&
			field.default === undefined
		) {
			data[field.name] = "";
		}
	}
	return data;
}

/** "Technologies" → "technology", "Links" → "link". */
export function singularLabel(label: string): string {
	const lower = label.toLowerCase();
	if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
	if (lower.endsWith("s")) return lower.slice(0, -1);
	return lower;
}

/** The initial draft for a new row: defaults, and false for required booleans. */
export function initialDraft(fields: FieldDescriptor[]): Row {
	const draft: Row = {};
	for (const field of fields) {
		if (field.default !== undefined) draft[field.name] = field.default;
		else if (field.type === "boolean" && field.required)
			draft[field.name] = false;
	}
	return draft;
}

/** Only the given fields of a row (list items come back with parent and position columns). */
export function pickFields(row: Row, names: string[]): Row {
	const picked: Row = {};
	for (const name of names) {
		if (row[name] !== undefined) picked[name] = row[name];
	}
	return picked;
}

// -------------------------------------------------------------------- diffs

export interface FieldChange {
	field: string;
	before: unknown;
	after: unknown;
}

/** Field-level differences between two rows, in a stable order. */
export function diffRows(
	before: Row | null | undefined,
	after: Row | null | undefined,
	options: { only?: string[]; ignore?: string[] } = {},
): FieldChange[] {
	const left = before ?? {};
	const right = after ?? {};
	const ignore = new Set(options.ignore ?? []);
	const keys = options.only ?? [
		...new Set([...Object.keys(left), ...Object.keys(right)]),
	];
	return keys
		.filter((key) => !ignore.has(key) && !deepEqual(left[key], right[key]))
		.map((key) => ({ field: key, before: left[key], after: right[key] }));
}

export type ListChange =
	| { kind: "added"; index: number; item: Row }
	| { kind: "removed"; index: number; item: Row }
	| { kind: "changed"; index: number; changes: FieldChange[] };

/** Position-by-position differences between two lists of items. */
export function diffLists(before: Row[], after: Row[]): ListChange[] {
	const changes: ListChange[] = [];
	const length = Math.max(before.length, after.length);
	for (let index = 0; index < length; index++) {
		const left = before[index];
		const right = after[index];
		if (left === undefined && right !== undefined) {
			changes.push({ kind: "added", index, item: right });
		} else if (right === undefined && left !== undefined) {
			changes.push({ kind: "removed", index, item: left });
		} else if (left && right) {
			const fieldChanges = diffRows(left, right);
			if (fieldChanges.length)
				changes.push({ kind: "changed", index, changes: fieldChanges });
		}
	}
	return changes;
}

/** A short, readable rendering of a stored value for diffs and tables. */
export function formatValue(value: unknown, max = 160): string {
	if (value === undefined || value === null) return "—";
	if (typeof value === "string")
		return value.length > max ? `${value.slice(0, max)}…` : value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (isRichTextDoc(value)) {
		const text = docText(value);
		return text.length > max
			? `${text.slice(0, max)}…`
			: text || "(empty document)";
	}
	const json = JSON.stringify(value);
	return json.length > max ? `${json.slice(0, max)}…` : json;
}

function isRichTextDoc(
	value: unknown,
): value is { type: "doc"; content?: unknown[] } {
	return (
		typeof value === "object" && value !== null && (value as Row).type === "doc"
	);
}

/** Plain text of a TipTap document, block by block, for previews. */
export function docText(node: unknown): string {
	if (typeof node !== "object" || node === null) return "";
	const n = node as { type?: string; text?: string; content?: unknown[] };
	if (n.type === "text") return n.text ?? "";
	const inner = (n.content ?? []).map(docText);
	const block =
		n.type === "doc" || n.type?.endsWith("List") || n.type === "blockquote";
	return inner.join(block ? " " : "").trim();
}

// ------------------------------------------------------------------- issues

/**
 * Validation issues grouped by top-level field. "matrix.status" belongs to
 * "matrix" and keeps "status: " as context; issues without a field (an empty
 * path) are grouped under "".
 */
export function issuesByField(issues: Issue[]): Record<string, string[]> {
	const grouped: Record<string, string[]> = {};
	for (const issue of issues) {
		const [head = "", ...rest] = issue.path.split(".").filter((s) => s !== "");
		const message = rest.length
			? `${rest.join(".")}: ${issue.message}`
			: issue.message;
		const list = grouped[head] ?? [];
		list.push(message);
		grouped[head] = list;
	}
	return grouped;
}

/**
 * List panel issues ("0.title", "2.url") grouped by item index and field.
 * Issues that do not start with an index land in `general`.
 */
export function issuesByItem(issues: Issue[]): {
	items: Record<number, Record<string, string[]>>;
	general: string[];
} {
	const items: Record<number, Record<string, string[]>> = {};
	const general: string[] = [];
	for (const issue of issues) {
		const [head = "", ...rest] = issue.path.split(".");
		const index = /^\d+$/.test(head) ? Number(head) : Number.NaN;
		if (Number.isNaN(index)) {
			general.push(
				issue.path ? `${issue.path}: ${issue.message}` : issue.message,
			);
			continue;
		}
		const byField = items[index] ?? {};
		items[index] = byField;
		for (const [field, messages] of Object.entries(
			issuesByField([{ path: rest.join("."), message: issue.message }]),
		)) {
			byField[field] = [...(byField[field] ?? []), ...messages];
		}
	}
	return { items, general };
}

// ---------------------------------------------------------- field behaviour

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isSlug = (value: string) => SLUG_PATTERN.test(value);

const LONG_TEXT_NAMES =
	/(description|body|biography|bio|summary|abstract|content|notes?|excerpt|quote|why|text|makesMeFeel|spicyTake)$/i;

/** Whether a text field gets a textarea: by name, or when its value is long. */
export function isLongText(name: string, value: unknown): boolean {
	if (LONG_TEXT_NAMES.test(name)) return true;
	return (
		typeof value === "string" && (value.length > 120 || value.includes("\n"))
	);
}

const UPLOAD_NAMES = /(cover|image|logo|avatar|thumbnail)/i;

/** URL fields that get an "Upload" button. */
export const isUploadField = (name: string) => UPLOAD_NAMES.test(name);

/**
 * Width/height fields that belong to an image URL field, when the row has
 * them: coverUrl → coverWidth/coverHeight, image → imageWidth/imageHeight.
 */
export function dimensionFields(
	name: string,
	fieldNames: string[],
): { width?: string; height?: string } {
	const prefix = name.replace(/(Url|URL|Src|Href)$/, "");
	const candidates = [prefix, name];
	const found: { width?: string; height?: string } = {};
	for (const base of candidates) {
		if (!found.width && fieldNames.includes(`${base}Width`))
			found.width = `${base}Width`;
		if (!found.height && fieldNames.includes(`${base}Height`))
			found.height = `${base}Height`;
	}
	return found;
}

/** The value for an emptied input: null when the field allows it. */
export function emptyValue(field: FieldDescriptor): null | "" | undefined {
	if (field.nullable) return null;
	if (field.type === "text" || field.type === "slug" || field.type === "url") {
		return field.required ? "" : undefined;
	}
	return field.required ? undefined : null;
}

// -------------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, "0");

/** A stored date (ISO string, epoch ms or Date) as a datetime-local value in local time. */
export function toDateTimeLocal(value: unknown): string {
	if (value === null || value === undefined || value === "") return "";
	const date =
		value instanceof Date
			? value
			: new Date(typeof value === "number" ? value : String(value));
	if (Number.isNaN(date.getTime())) return "";
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** A datetime-local value (local time) as an ISO string; null when empty or invalid. */
export function fromDateTimeLocal(value: string): string | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A timestamp for tables: "2026-10-25 14:03". */
export function formatTime(value: unknown): string {
	if (value === null || value === undefined) return "—";
	const date = new Date(typeof value === "number" ? value : String(value));
	if (Number.isNaN(date.getTime())) return String(value);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}`;
}

// ---------------------------------------------------------------------- json

/** Parses a JSON textarea; empty text is null. */
export function parseJson(
	text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
	if (!text.trim()) return { ok: true, value: null };
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Invalid JSON",
		};
	}
}

export const stringifyJson = (value: unknown): string =>
	value === null || value === undefined ? "" : JSON.stringify(value, null, 2);

// ---------------------------------------------------------------------- urls

/** An id for API URLs: one segment, even when it contains "/". */
export const apiId = (id: string) => encodeURIComponent(id);

/** An id for page URLs (rest routes): each segment encoded, "/" kept. */
export const pageId = (id: string) =>
	id.split("/").map(encodeURIComponent).join("/");

export const entityPath = (collection: string, id: string) =>
	`/c/${encodeURIComponent(collection)}/${pageId(id)}`;

export const entityApiPath = (collection: string, id: string) =>
	`/collections/${encodeURIComponent(collection)}/${apiId(id)}`;

/** Moves an item in a list by delta, returning a new array (no-op at the edges). */
export function move<T>(list: T[], index: number, delta: number): T[] {
	const target = index + delta;
	if (index < 0 || index >= list.length || target < 0 || target >= list.length)
		return list;
	const next = [...list];
	const [item] = next.splice(index, 1);
	next.splice(target, 0, item as T);
	return next;
}

/** The displayed title of a row. */
export function titleOf(row: Row, titleField: string, key: string): string {
	const title = row[titleField];
	if (typeof title === "string" && title.trim()) return title;
	return String(row[key] ?? "(untitled)");
}
