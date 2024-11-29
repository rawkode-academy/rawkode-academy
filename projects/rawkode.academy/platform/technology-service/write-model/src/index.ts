import { createClient } from "@libsql/client";
import { type Context, endpoint, service, TerminalError } from "@restatedev/restate-sdk/fetch";
import slugify from "@sindresorhus/slugify";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import type { z } from "zod";
import { CreateTechnology } from "../../data-model/integrations/zod.ts";
import { technologiesTable } from "../../data-model/schema/index.ts";

type T = z.infer<typeof CreateTechnology>;

interface Env {
	RESTATE_IDENTITY_KEY: string;
	TURSO_TOKEN: string;
	TURSO_URL: string;
}

const technologyService = service({
	name: "technology",
	handlers: {
		create: async (ctx: Context, technology: T) => {
			try {
				CreateTechnology.parse(technology);
			} catch (e) {
				return {
					message: "Failed to create technology.",
					error: e,
				};
			}

			const [env] = ctx.request().extraArgs as [Env];

			const client = createClient({
				url: env.TURSO_URL as string,
				authToken: env.TURSO_TOKEN,
			});

			const id = slugify(technology.name, {
				lowercase: true,
			});

			const db = drizzle(client);

			ctx.console.log("Checking unique constraints are passing before writing to database");

			const checks = await db.select().from(technologiesTable).where(eq(technologiesTable.id, id));

			if (checks.length > 0) {
				throw new TerminalError(`New technology, ${technology.name}, does not pass unique ID constraints. ID was generated as ${id}.`, { errorCode: 400 });
			}

			ctx.console.log(`Attempting to create technology with url ${env.TURSO_URL}`);

			await db
				.insert(technologiesTable)
				.values({
					...technology,
					id,
				})
				.run();

			return "Job done";
		},
	},
});

export default {
	async fetch(request: Request, env: Env, ctx: Context) {
		const handler = endpoint()
			.bind(technologyService)
			.withIdentityV1(env.RESTATE_IDENTITY_KEY)
			.handler();

		return handler.fetch(request, env, ctx);
	},
};
