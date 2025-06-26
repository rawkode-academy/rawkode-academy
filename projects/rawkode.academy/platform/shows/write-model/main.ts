import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import slugify from "@sindresorhus/slugify";
import { Hono } from "hono";
import { createShow } from "../data-model/integrations/zod.ts";
import * as schema from "../data-model/schema.ts";

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/", async (c) => {
	const db = drizzle(c.env.DB, { schema });

	const newShow = createShow.safeParse(await c.req.json());

	if (newShow.success === false) {
		return c.json({ error: newShow.error.flatten() }, { status: 400 });
	}

	const { name } = newShow.data;

	try {
		const result = await db
			.insert(schema.showsTable)
			.values({
				id: slugify(name, {
					lowercase: true,
					separator: "-",
				}),
				name,
			})
			.returning()
			.get();

		return c.json(
			{
				success: true,
				message: "Show created successfully",
				data: result,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating show:", error);
		return c.json(
			{ error: "Failed to create show" },
			{ status: 500 },
		);
	}
});

export default app;
