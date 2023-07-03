import type { Field } from "payload/types";
import deepMerge from "../utilities/deepMerge";

type Slug = (fieldToUse?: string, overrides?: Partial<Field>) => Field;

export const slugField: Slug = (fieldToUse = "title", overrides = {}) =>
	deepMerge<Field, Partial<Field>>(
		{
			name: "slug",
			label: "Slug",
			type: "text",
			index: true,
			unique: true,
			admin: {
				position: "sidebar",
			},
			hooks: {
				beforeValidate: [formatSlug(fieldToUse)],
			},
		},
		overrides,
	);

import type { FieldHook } from "payload/types";

const format = (val: string): string =>
	val.replace(/ /g, "-").replace(/[^\w-]+/g, "").toLowerCase();

const formatSlug =
	(fallback: string): FieldHook =>
	({ value, originalDoc, data }) => {
		const fallbackData = data?.[fallback] || originalDoc?.[fallback];

		if (fallbackData && typeof fallbackData === "string") {
			return format(fallbackData);
		}

		return value;
	};
