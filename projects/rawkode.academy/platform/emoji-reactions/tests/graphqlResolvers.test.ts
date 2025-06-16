import { describe, it, expect } from "bun:test";
import { getSchema } from "../read-model/schema";
import { parse, validate } from "graphql";

describe("GraphQL Resolvers", () => {
	const mockEnv = {
		DB: {} as D1Database,
	};

	it("should have valid getTopEmojiReactions query", () => {
		const schema = getSchema(mockEnv);
		const query = `
			query {
				getTopEmojiReactions(limit: 3) {
					emoji
					count
				}
			}
		`;

		const documentAST = parse(query);
		const errors = validate(schema, documentAST);

		expect(errors).toEqual([]);
	});

	it("should have valid getEmojiReactionsForContent query", () => {
		const schema = getSchema(mockEnv);
		const query = `
			query {
				getEmojiReactionsForContent(contentId: "video-123") {
					emoji
					count
				}
			}
		`;

		const documentAST = parse(query);
		const errors = validate(schema, documentAST);

		expect(errors).toEqual([]);
	});

	it("should validate federation entity queries", () => {
		const schema = getSchema(mockEnv);
		const query = `
			query {
				_entities(representations: [{ __typename: "Video", id: "123" }]) {
					... on Video {
						id
						emojiReactions {
							emoji
							count
						}
						hasReacted(personId: "user-123", emoji: "👍")
					}
				}
			}
		`;

		const documentAST = parse(query);
		const errors = validate(schema, documentAST);

		expect(errors).toEqual([]);
	});
});
