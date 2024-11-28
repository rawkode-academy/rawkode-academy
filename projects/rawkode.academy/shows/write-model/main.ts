import { createClient } from "@libsql/client";
import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from "@restatedev/restate-sdk/fetch";
import slugify from "@sindresorhus/slugify";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";
import { CreateShow } from "../data-model/integrations/zod.ts";
import { showsTable } from "../data-model/schema.ts";

// This avoids using polyfilled node APIs
Deno.env.set("USE_WEB_CRYPTO", "true");

type T = z.infer<typeof CreateShow>;

const showsService = service({
	name: "show",
	handlers: {
		create: async (ctx: Context, show: T) => {
			try {
				CreateShow.parse(show);
			} catch (e) {
				return {
					message: "Failed to create show.",
					error: e,
				};
			}

			const client = createClient({
				url: Deno.env.get("LIBSQL_URL") || "",
				authToken: Deno.env.get("LIBSQL_TOKEN") || "",
			});

			const id = slugify(show.name, {
				lowercase: true,
			});

			const db = drizzle(client);

			ctx.console.log(
				"Checking unique constraints are passing before writing to database",
			);

			const checks = await db.select().from(showsTable).where(
				eq(showsTable.id, id),
			);

			if (checks.length > 0) {
				throw new TerminalError(
					`New show, ${show.name}, does not pass unique ID constraints. ID was generated as ${id}.`,
					{ errorCode: 400 },
				);
			}

			await db
				.insert(showsTable)
				.values({
					...show,
					id,
				})
				.run();

			return "Job done";
		},
	},
});

const handler = endpoint().bind(showsService).withIdentityV1(
	Deno.env.get("RESTATE_IDENTITY_KEY") || "",
).bidirectional().handler();

Deno.serve({ port: parseInt(Deno.env.get("PORT") || "9080", 10) }, handler.fetch);
