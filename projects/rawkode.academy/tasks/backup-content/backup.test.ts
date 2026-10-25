import { describe, expect, test } from "bun:test";
import { checkExport, contentDatabaseOf, contentDatabases } from "./backup";

describe("content backups", () => {
	test("reads the DB database name of content services only", () => {
		const cue = `_service: gen.#PlatformService & {
	serviceName:       "technologies"
	contentWriteModel: true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-technologies"
			databaseId: "4671b796"
		}]
	}
}`;
		expect(contentDatabaseOf(cue)).toBe("platform-technologies");
		expect(contentDatabaseOf(cue.replace("contentWriteModel: true", ""))).toBeUndefined();
	});

	test("finds every content service in the repository", async () => {
		const databases = await contentDatabases();
		const names = databases.map((d) => d.database);
		expect(names).toContain("platform-technologies");
		expect(names).toContain("platform-articles");
		expect(names.every((n) => n.startsWith("platform-"))).toBe(true);
		expect(new Set(names).size).toBe(names.length);
	});

	test("rejects exports without tables", () => {
		expect(() => checkExport("PRAGMA foreign_keys=OFF;")).toThrow();
		expect(
			checkExport(
				"CREATE TABLE a (id text);\nINSERT INTO a VALUES('x');\nINSERT INTO a VALUES('y');",
			),
		).toEqual({ tables: 1, inserts: 2 });
	});
});
