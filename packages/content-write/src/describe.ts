// Plain-data descriptions of a service's models, derived from their zod
// schemas, so an editor (the CMS) can build forms that match what the write
// model will accept without importing the service's code.
import { z } from "zod";
import type { Model, ServiceModels } from "./model";

export type FieldType =
	| "text"
	| "slug"
	| "url"
	| "number"
	| "boolean"
	| "date"
	| "enum"
	| "rich-text"
	| "strings"
	| "json";

export interface FieldDescriptor {
	name: string;
	type: FieldType;
	/** The field must be present and non-null for the row to be valid. */
	required: boolean;
	nullable: boolean;
	/** Allowed values for "enum" (and for "strings" when the items are an enum). */
	options?: string[];
	/** The default applied when the field is left out. */
	default?: unknown;
}

export interface ModelDescriptor {
	name: string;
	kind: Model["kind"];
	/** Entity key property. */
	key?: string;
	/** List parent properties and position column. */
	parent?: string[];
	position?: string;
	/** Entity row fields, or one list item's fields. */
	fields: FieldDescriptor[];
}

const HINTS = new Set(["slug", "url", "rich-text"]);

/** Walks wrappers (optional, nullable, default, effects) down to the base type. */
function inspect(schema: z.ZodTypeAny): {
	base: z.ZodTypeAny;
	hint?: string;
	optional: boolean;
	nullable: boolean;
	default?: unknown;
} {
	let current: z.ZodTypeAny = schema;
	let hint: string | undefined;
	let optional = false;
	let nullable = false;
	let fallback: unknown;
	for (let depth = 0; depth < 20; depth++) {
		if (!hint && current.description && HINTS.has(current.description)) {
			hint = current.description;
		}
		if (current instanceof z.ZodOptional) {
			optional = true;
			current = current.unwrap();
		} else if (current instanceof z.ZodNullable) {
			nullable = true;
			current = current.unwrap();
		} else if (current instanceof z.ZodDefault) {
			optional = true;
			fallback = current._def.defaultValue();
			current = current._def.innerType;
		} else if (current instanceof z.ZodEffects) {
			current = current.innerType();
		} else if (current instanceof z.ZodBranded) {
			current = current.unwrap();
		} else if (current instanceof z.ZodPipeline) {
			current = current._def.in;
		} else {
			break;
		}
	}
	return { base: current, hint, optional, nullable, default: fallback };
}

function typeOf(base: z.ZodTypeAny, hint: string | undefined): {
	type: FieldType;
	options?: string[];
} {
	if (hint === "rich-text") return { type: "rich-text" };
	if (hint === "slug") return { type: "slug" };
	if (hint === "url") return { type: "url" };
	if (base instanceof z.ZodString) return { type: "text" };
	if (base instanceof z.ZodNumber) return { type: "number" };
	if (base instanceof z.ZodBoolean) return { type: "boolean" };
	if (base instanceof z.ZodDate) return { type: "date" };
	if (base instanceof z.ZodEnum) return { type: "enum", options: [...base.options] };
	if (base instanceof z.ZodNativeEnum) {
		return { type: "enum", options: Object.values(base.enum).map(String) };
	}
	if (base instanceof z.ZodArray) {
		const item = inspect(base.element);
		if (item.base instanceof z.ZodString) return { type: "strings" };
		if (item.base instanceof z.ZodEnum) {
			return { type: "strings", options: [...item.base.options] };
		}
	}
	return { type: "json" };
}

/** The object shape behind a schema (unwrapping refinements), when it has one. */
function shapeOf(schema: z.ZodTypeAny): z.ZodRawShape | undefined {
	const { base } = inspect(schema);
	return base instanceof z.ZodObject ? (base.shape as z.ZodRawShape) : undefined;
}

export function describeFields(schema: z.ZodTypeAny): FieldDescriptor[] {
	const shape = shapeOf(schema);
	if (!shape) return [];
	return Object.entries(shape).map(([name, field]) => {
		const info = inspect(field);
		const { type, options } = typeOf(info.base, info.hint);
		return {
			name,
			type,
			required: !info.optional && !info.nullable,
			nullable: info.nullable,
			...(options ? { options } : {}),
			...(info.default !== undefined ? { default: info.default } : {}),
		};
	});
}

export function describeModels(service: ServiceModels): ModelDescriptor[] {
	return service.models.map((model) =>
		model.kind === "entity"
			? {
					name: model.name,
					kind: model.kind,
					key: model.key,
					fields: describeFields(model.schema),
				}
			: {
					name: model.name,
					kind: model.kind,
					parent: model.parent,
					...(model.position ? { position: model.position } : {}),
					fields: describeFields(model.item),
				},
	);
}
