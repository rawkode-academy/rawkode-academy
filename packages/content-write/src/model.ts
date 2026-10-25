import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { Row } from "./types";

/**
 * A table whose rows are edited one at a time: technologies, videos, articles.
 * Revisions are kept per row, under `name`.
 */
export interface EntityModel {
	kind: "entity";
	/** RPC and revision name, e.g. "technology". Unique within the service. */
	name: string;
	table: SQLiteTable;
	/** Property of the single-column primary key, e.g. "id" or "videoId". */
	key: string;
	/** Validates a whole row (after a patch is merged into the stored row). */
	schema: z.ZodTypeAny;
	/** Website cache tags for a row: always include its own entity tag. */
	tags: (row: Row) => string[];
	/** Computes derived columns (Markdown copies of rich text) before writing. */
	derive?: (row: Row) => Row;
	/** Properties matched by list search (LIKE %term%). */
	search?: string[];
	/** List order; defaults to the key, ascending. */
	orderBy?: { column: string; direction: "asc" | "desc" };
}

/**
 * Rows that belong to a parent and are always saved together, in order: a
 * video's guests, a person's links, a technology's transcription terms.
 * Revisions are kept per parent, under `name`.
 */
export interface ListModel {
	kind: "list";
	/** RPC and revision name, e.g. "video-guests". */
	name: string;
	table: SQLiteTable;
	/** Properties identifying the parent, e.g. ["videoId"] or ["kind", "foreignId"]. */
	parent: string[];
	/** Property holding the item's index in the list, when the table has one. */
	position?: string;
	/** Read order when there is no position column, e.g. "startTime". */
	orderBy?: string;
	/** Validates one item, without the parent or position properties. */
	item: z.ZodTypeAny;
	/** Website cache tags for a parent and its items (old and new items both pass through). */
	tags: (parent: Row, items: Row[]) => string[];
}

export type Model = EntityModel | ListModel;

export interface ServiceModels {
	/** The service name, for logs. */
	service: string;
	models: Model[];
}

export const defineModels = (service: string, models: Model[]): ServiceModels => {
	const names = new Set<string>();
	for (const model of models) {
		if (names.has(model.name)) {
			throw new Error(`${service}: duplicate model name "${model.name}"`);
		}
		names.add(model.name);
		const columns = getTableColumns(model.table);
		const props =
			model.kind === "entity"
				? [model.key, ...(model.search ?? []), model.orderBy?.column]
				: [...model.parent, model.position, model.orderBy];
		for (const prop of props) {
			if (prop && !(prop in columns)) {
				throw new Error(`${service}/${model.name}: unknown column "${prop}"`);
			}
		}
	}
	return { service, models };
};

type Refinements = Record<string, z.ZodTypeAny>;

/**
 * A zod schema for a table's insert row, as drizzle-zod builds it, with every
 * timestamp column coerced from ISO strings (JSON over HTTP) and the given
 * column overrides (JSON columns, rich text, enums kept outside the table).
 */
export function rowSchema(
	table: SQLiteTable,
	overrides: Refinements = {},
): z.ZodObject<z.ZodRawShape> {
	const columns = getTableColumns(table);
	const refine: Refinements = {};
	for (const [prop, column] of Object.entries(columns)) {
		if (prop in overrides) continue;
		if (column.columnType === "SQLiteTimestamp") {
			const date = z.coerce.date();
			refine[prop] = column.notNull ? date : date.nullable().optional();
		}
	}
	// biome-ignore lint/suspicious/noExplicitAny: drizzle-zod's refine map is keyed by the table's columns
	const base = createInsertSchema(table, { ...refine, ...overrides } as any);
	return base as unknown as z.ZodObject<z.ZodRawShape>;
}

/** A required, non-empty, trimmed string. */
export const requiredText = () => z.string().trim().min(1);

/** A kebab-case public slug: the id convention for content. */
export const slug = () =>
	z
		.string()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a kebab-case slug, e.g. my-entry");

/** An absolute http(s) URL. */
export const httpUrl = () =>
	z
		.string()
		.url()
		.refine((value) => /^https?:\/\//.test(value), "Use an http(s) URL");
