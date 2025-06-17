import { describe, it, expect } from "bun:test";
import { getSchema } from "../read-model/schema";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";

describe("GraphQL Schema", () => {
	const mockEnv = {
		DB: {} as D1Database,
	};

	it("should create a valid GraphQL schema", () => {
		const schema = getSchema(mockEnv);
		expect(schema).toBeDefined();
		expect(schema.getQueryType()).toBeDefined();
	});

	it("should have EmojiReaction type", () => {
		const schema = getSchema(mockEnv);
		const emojiReactionType = schema.getType("EmojiReaction");
		expect(emojiReactionType).toBeDefined();
		expect(emojiReactionType?.astNode?.kind).toBe("ObjectTypeDefinition");
	});

	it("should have correct fields on EmojiReaction type", () => {
		const schema = getSchema(mockEnv);
		const emojiReactionType = schema.getType("EmojiReaction") as any;
		const fields = emojiReactionType.getFields();

		expect(fields.emoji).toBeDefined();
		expect(fields.emoji.type.toString()).toBe("String");

		expect(fields.count).toBeDefined();
		expect(fields.count.type.toString()).toBe("Int");
	});

	it("should extend Video type with emoji reactions", () => {
		const schema = getSchema(mockEnv);
		const videoType = schema.getType("Video") as any;

		expect(videoType).toBeDefined();
		const fields = videoType.getFields();

		expect(fields.emojiReactions).toBeDefined();
		expect(fields.emojiReactions.type.toString()).toBe("[EmojiReaction!]");

		expect(fields.hasReacted).toBeDefined();
		expect(fields.hasReacted.type.toString()).toBe("Boolean");
		expect(fields.hasReacted.args.length).toBe(2);
		expect(
			fields.hasReacted.args.find((arg: any) => arg.name === "personId"),
		).toBeDefined();
		expect(
			fields.hasReacted.args.find((arg: any) => arg.name === "emoji"),
		).toBeDefined();
	});

	it("should have query fields", () => {
		const schema = getSchema(mockEnv);
		const queryType = schema.getQueryType();
		const fields = queryType?.getFields();

		expect(fields?.getTopEmojiReactions).toBeDefined();
		expect(fields?.getTopEmojiReactions.type.toString()).toBe(
			"[EmojiReaction!]",
		);
		expect(fields?.getTopEmojiReactions.args.length).toBe(1);

		expect(fields?.getEmojiReactionsForContent).toBeDefined();
		expect(fields?.getEmojiReactionsForContent.type.toString()).toBe(
			"[EmojiReaction!]",
		);
		expect(fields?.getEmojiReactionsForContent.args.length).toBe(1);
	});

	it("should include federation directives", () => {
		const schema = getSchema(mockEnv);
		const schemaString = printSchemaWithDirectives(
			lexicographicSortSchema(schema),
		);

		expect(schemaString).toContain("@link");
		expect(schemaString).toContain("federation/v2.6");
	});
});
