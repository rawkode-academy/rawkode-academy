import { createClient } from "@libsql/client";
import { type Context, endpoint, service } from "@restatedev/restate-sdk/fetch";
import slugify from "@sindresorhus/slugify";
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

			ctx.console.log(`Attempting to create technology with url ${env.TURSO_URL}`);

			const db = drizzle(client);
			await db
				.insert(technologiesTable)
				.values({
					...technology,
					id: slugify(technology.name, {
						lowercase: true,
					}),
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
