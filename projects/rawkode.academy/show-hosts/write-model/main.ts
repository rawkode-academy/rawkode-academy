import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from "@restatedev/restate-sdk/fetch";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from '../data-model/client.ts';
import { AddHostToShow } from "../data-model/integrations/zod.ts";
import { showHostsTable } from "../data-model/schema.ts";

// This avoids using polyfilled node APIs
Deno.env.set("USE_WEB_CRYPTO", "true");

type T = z.infer<typeof AddHostToShow>;

const showsService = service({
	name: "show-hosts",
	handlers: {
		add: async (ctx: Context, showHost: T) => {
			try {
				AddHostToShow.parse(showHost);
			} catch (e) {
				return {
					message: "Failed to create show.",
					error: e,
				};
			}

			ctx.console.log(
				"Checking unique constraints are passing before writing to database",
			);

			const checks = await db.select().from(showHostsTable).where(
				and(
					eq(showHostsTable.showId, showHost.showId),
					eq(showHostsTable.hostId, showHost.hostId),
				),
			);

			if (checks.length > 0) {
				throw new TerminalError(
					`Show ${showHost.showId} already has host ${showHost.hostId}`,
					{ errorCode: 400 },
				);
			}

			await db
				.insert(showHostsTable)
				.values(showHost)
				.run();

			return "Job done";
		},
	},
});

const handler = endpoint().bind(showsService).withIdentityV1(
	Deno.env.get("RESTATE_IDENTITY_KEY") || "",
).bidirectional().handler();

Deno.serve({ port: 9080 }, handler.fetch);
