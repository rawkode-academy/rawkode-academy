import { createClient } from "@libsql/client";
import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from "@restatedev/restate-sdk/fetch";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";
import { CreatePerson } from "../data-model/integrations/zod.ts";
import { peopleTable } from "../data-model/schema.ts";

// This avoids using polyfilled node APIs
Deno.env.set("USE_WEB_CRYPTO", "true");

type T = z.infer<typeof CreatePerson>;

const peopleService = service({
	name: "person",
	handlers: {
		create: async (ctx: Context, person: T) => {
			try {
				CreatePerson.parse(person);
			} catch (e) {
				return {
					message: "Failed to create person.",
					error: e,
				};
			}

			const client = createClient({
				url: Deno.env.get("LIBSQL_URL") || "",
				authToken: Deno.env.get("LIBSQL_TOKEN") || "",
			});

			const db = drizzle(client);

			ctx.console.log(
				"Checking unique constraints are passing before writing to database",
			);

			const checks = await db.select().from(peopleTable).where(
				eq(peopleTable.id, person.id),
			);

			if (checks.length > 0) {
				throw new TerminalError(
					`New person, ${person.id}, does not pass unique ID constraints.`,
					{ errorCode: 400 },
				);
			}

			await db
				.insert(peopleTable)
				.values(person)
				.run();

			return "Job done";
		},
	},
});

const handler = endpoint().bind(peopleService).withIdentityV1(
	Deno.env.get("RESTATE_IDENTITY_KEY") || "",
).bidirectional().handler();

Deno.serve({ port: 9080 }, handler.fetch);
