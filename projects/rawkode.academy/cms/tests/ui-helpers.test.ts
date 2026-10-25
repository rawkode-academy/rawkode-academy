import { describe, expect, test } from "bun:test";
import type { FieldDescriptor } from "@rawkodeacademy/content-write";
import { extensions, validateDoc } from "@rawkodeacademy/rich-text/schema";
import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import {
	apiId,
	computePatch,
	createPayload,
	deepEqual,
	diffLists,
	diffRows,
	dimensionFields,
	docText,
	emptyValue,
	entityApiPath,
	entityPath,
	formatValue,
	fromDateTimeLocal,
	hiddenCreateDefaults,
	initialDraft,
	isLongText,
	isSlug,
	isUploadField,
	issuesByField,
	issuesByItem,
	move,
	pageId,
	parseJson,
	pickFields,
	singularLabel,
	titleOf,
	toDateTimeLocal,
} from "../src/components/ui-helpers";

const field = (
	name: string,
	type: FieldDescriptor["type"],
	extra: Partial<FieldDescriptor> = {},
) =>
	({
		name,
		type,
		required: false,
		nullable: false,
		...extra,
	}) as FieldDescriptor;

describe("deepEqual", () => {
	test("ignores key order and treats null and undefined alike", () => {
		expect(
			deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }),
		).toBe(true);
		expect(deepEqual(null, undefined)).toBe(true);
		expect(deepEqual({ a: null }, {})).toBe(true);
		expect(deepEqual([1, 2], [2, 1])).toBe(false);
		expect(deepEqual({ a: [] }, { a: {} })).toBe(false);
		expect(deepEqual("1", 1)).toBe(false);
	});
});

describe("computePatch", () => {
	test("sends only changed fields", () => {
		const original = {
			id: "k8s",
			name: "Kubernetes",
			aliases: ["k8s"],
			matrix: { status: "adopt" },
		};
		const draft = {
			...original,
			name: "Kubernetes!",
			matrix: { status: "adopt" },
		};
		expect(computePatch(original, draft)).toEqual({ name: "Kubernetes!" });
	});

	test("nested changes send the whole field", () => {
		const original = { matrix: { status: "adopt", why: "x" } };
		expect(
			computePatch(original, { matrix: { status: "trial", why: "x" } }),
		).toEqual({
			matrix: { status: "trial", why: "x" },
		});
	});

	test("a cleared field is sent as null", () => {
		expect(
			computePatch({ website: "https://a.dev" }, { website: undefined }),
		).toEqual({ website: null });
	});

	test("no changes is an empty patch", () => {
		expect(computePatch({ a: 1, b: null }, { a: 1 })).toEqual({});
	});
});

describe("createPayload and initialDraft", () => {
	const fields = [
		field("id", "slug", { required: true }),
		field("name", "text", { required: true }),
		field("license", "text", { default: "Unknown" }),
		field("draft", "boolean", { required: true }),
		field("aliases", "strings", { nullable: true }),
		field("website", "url", { nullable: true }),
	];

	test("drafts start with defaults and false booleans", () => {
		expect(initialDraft(fields)).toEqual({ license: "Unknown", draft: false });
	});

	test("required lists are sent even when empty", () => {
		expect(
			createPayload({ authors: [], tags: [] }, [
				field("authors", "strings", { required: true }),
				field("tags", "strings"),
			]),
		).toEqual({ authors: [] });
	});

	test("empty values are left out; booleans are always sent", () => {
		expect(
			createPayload(
				{
					id: "k8s",
					name: "",
					aliases: [],
					website: null,
					draft: false,
					extra: 1,
				},
				fields,
			),
		).toEqual({ id: "k8s", draft: false });
	});
});

describe("hiddenCreateDefaults", () => {
	test("required hidden text fields without defaults are sent empty", () => {
		const fields = [
			field("description", "text", { required: true }),
			field("updatedAt", "date", { nullable: true }),
			field("license", "text", { required: false, default: "Unknown" }),
			field("name", "text", { required: true }),
		];
		expect(hiddenCreateDefaults(fields, ["updatedAt", "description"])).toEqual({
			description: "",
		});
		expect(hiddenCreateDefaults(fields, ["updatedAt"])).toEqual({});
	});
});

describe("diffs", () => {
	test("diffRows lists changed fields, honouring ignore", () => {
		expect(
			diffRows(
				{ a: 1, b: 2, updatedAt: "x" },
				{ a: 1, b: 3, c: 4, updatedAt: "y" },
				{ ignore: ["updatedAt"] },
			),
		).toEqual([
			{ field: "b", before: 2, after: 3 },
			{ field: "c", before: undefined, after: 4 },
		]);
	});

	test("diffRows handles a missing side", () => {
		expect(diffRows(null, { a: 1 })).toEqual([
			{ field: "a", before: undefined, after: 1 },
		]);
	});

	test("diffLists reports added, removed and changed items by position", () => {
		const before = [{ guestId: "a" }, { guestId: "b" }, { guestId: "c" }];
		const after = [{ guestId: "a" }, { guestId: "x" }];
		expect(diffLists(before, after)).toEqual([
			{
				kind: "changed",
				index: 1,
				changes: [{ field: "guestId", before: "b", after: "x" }],
			},
			{ kind: "removed", index: 2, item: { guestId: "c" } },
		]);
		expect(diffLists([], [{ term: "k8s" }])).toEqual([
			{ kind: "added", index: 0, item: { term: "k8s" } },
		]);
	});
});

describe("issue paths", () => {
	test("issuesByField groups by the top-level field", () => {
		expect(
			issuesByField([
				{ path: "name", message: "Required" },
				{ path: "matrix.status", message: "Invalid enum value" },
				{ path: "resources.0.url", message: "Use an http(s) URL" },
				{ path: "", message: "Whole row" },
			]),
		).toEqual({
			name: ["Required"],
			matrix: ["status: Invalid enum value"],
			resources: ["0.url: Use an http(s) URL"],
			"": ["Whole row"],
		});
	});

	test("issuesByItem groups list issues by index and field", () => {
		expect(
			issuesByItem([
				{ path: "0.title", message: "Required" },
				{ path: "2.url", message: "Use an http(s) URL" },
				{ path: "2.embedConfig.src", message: "Required" },
				{ path: "items", message: "Too many" },
			]),
		).toEqual({
			items: {
				0: { title: ["Required"] },
				2: { url: ["Use an http(s) URL"], embedConfig: ["src: Required"] },
			},
			general: ["items: Too many"],
		});
	});
});

describe("field behaviour", () => {
	test("slugs", () => {
		expect(isSlug("my-entry-2")).toBe(true);
		expect(isSlug("My-entry")).toBe(false);
		expect(isSlug("my--entry")).toBe(false);
		expect(isSlug("-entry")).toBe(false);
	});

	test("long text by name or value", () => {
		expect(isLongText("description", "")).toBe(true);
		expect(isLongText("body", null)).toBe(true);
		expect(isLongText("title", "short")).toBe(false);
		expect(isLongText("title", "a\nb")).toBe(true);
		expect(isLongText("title", "x".repeat(200))).toBe(true);
	});

	test("upload fields", () => {
		expect(isUploadField("coverUrl")).toBe(true);
		expect(isUploadField("thumbnailUrl")).toBe(true);
		expect(isUploadField("logo")).toBe(true);
		expect(isUploadField("website")).toBe(false);
	});

	test("dimension companions", () => {
		const names = [
			"coverUrl",
			"coverAlt",
			"coverWidth",
			"coverHeight",
			"image",
			"imageWidth",
		];
		expect(dimensionFields("coverUrl", names)).toEqual({
			width: "coverWidth",
			height: "coverHeight",
		});
		expect(dimensionFields("image", names)).toEqual({ width: "imageWidth" });
		expect(dimensionFields("avatarUrl", names)).toEqual({});
	});

	test("empty values follow nullability", () => {
		expect(emptyValue(field("website", "url", { nullable: true }))).toBe(null);
		expect(emptyValue(field("name", "text", { required: true }))).toBe("");
		expect(emptyValue(field("subtitle", "text"))).toBe(undefined);
		expect(emptyValue(field("count", "number"))).toBe(null);
	});
});

describe("dates", () => {
	test("round-trips through datetime-local in local time", () => {
		const iso = "2026-03-04T05:06:07.000Z";
		const local = toDateTimeLocal(iso);
		expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
		expect(fromDateTimeLocal(local)).toBe(iso);
		expect(toDateTimeLocal(Date.parse(iso))).toBe(local);
	});

	test("empty and invalid values", () => {
		expect(toDateTimeLocal(null)).toBe("");
		expect(toDateTimeLocal("nope")).toBe("");
		expect(fromDateTimeLocal("")).toBe(null);
	});
});

describe("json", () => {
	test("parses, treats empty as null and reports errors", () => {
		expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
		expect(parseJson("  ")).toEqual({ ok: true, value: null });
		expect(parseJson("{a:1}").ok).toBe(false);
	});
});

describe("urls", () => {
	test("API ids are one segment; page ids keep slashes", () => {
		expect(apiId("course/module one")).toBe("course%2Fmodule%20one");
		expect(pageId("course/module one")).toBe("course/module%20one");
		expect(entityApiPath("course-modules", "c/m")).toBe(
			"/collections/course-modules/c%2Fm",
		);
		expect(entityPath("course-modules", "c/m")).toBe("/c/course-modules/c/m");
	});
});

describe("lists and display", () => {
	test("move swaps neighbours and ignores the edges", () => {
		expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
		expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
		const list = ["a", "b"];
		expect(move(list, 0, -1)).toBe(list);
		expect(move(list, 1, 1)).toBe(list);
	});

	test("singularLabel", () => {
		expect(singularLabel("Technologies")).toBe("technology");
		expect(singularLabel("Links")).toBe("link");
		expect(singularLabel("Episode")).toBe("episode");
	});

	test("pickFields drops parent and position columns", () => {
		expect(
			pickFields({ videoId: "v", position: 0, guestId: "g" }, ["guestId"]),
		).toEqual({ guestId: "g" });
	});

	test("titleOf falls back to the key", () => {
		expect(titleOf({ id: "k8s", name: "Kubernetes" }, "name", "id")).toBe(
			"Kubernetes",
		);
		expect(titleOf({ id: "k8s", name: " " }, "name", "id")).toBe("k8s");
	});

	test("formatValue renders documents as text and truncates", () => {
		const doc = {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "Hello" }] },
				{ type: "paragraph", content: [{ type: "text", text: "world" }] },
			],
		};
		expect(docText(doc)).toBe("Hello world");
		expect(formatValue(doc)).toBe("Hello world");
		expect(formatValue(null)).toBe("—");
		expect(formatValue("x".repeat(10), 4)).toBe("xxxx…");
		expect(formatValue({ a: 1 })).toBe('{"a":1}');
	});
});

// The editor is built from exactly these extensions. With TipTap's core
// extensions added (as the editor does), the schema must still serialise a
// stored document back unchanged, atoms included.
describe("rich-text editor schema", () => {
	test("stored documents round-trip through the editor schema", () => {
		const doc = {
			type: "doc",
			content: [
				{
					type: "heading",
					attrs: { level: 2, id: "intro" },
					content: [{ type: "text", text: "Intro" }],
				},
				{
					type: "paragraph",
					content: [
						{ type: "text", marks: [{ type: "bold" }], text: "bold" },
						{
							type: "text",
							marks: [
								{
									type: "link",
									attrs: {
										href: "https://rawkode.academy",
										target: null,
										rel: null,
										class: null,
										title: null,
									},
								},
							],
							text: " link",
						},
					],
				},
				{ type: "video", attrs: { videoId: "abc123", thumbnailUrl: null } },
				{
					type: "interactive",
					attrs: {
						component: "CgroupTimeline",
						props: { a: 1 },
						hydrate: "visible",
					},
				},
				{
					type: "diagram",
					attrs: {
						id: null,
						title: "Flow",
						description: null,
						language: "d2",
						source: "a -> b",
						meta: null,
						src: null,
					},
				},
				{
					type: "embed",
					attrs: {
						src: "https://x.dev",
						title: null,
						width: 640,
						height: null,
						allow: null,
						allowFullscreen: true,
					},
				},
				{
					type: "aside",
					attrs: { variant: "tip" },
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "Note" }] },
					],
				},
			],
		};
		const editorSchema = getSchema(extensions);
		const node = Node.fromJSON(editorSchema, doc);
		node.check();
		expect(node.toJSON()).toEqual(doc);
		expect(validateDoc(node.toJSON()).toJSON()).toEqual(doc);
	});
});
