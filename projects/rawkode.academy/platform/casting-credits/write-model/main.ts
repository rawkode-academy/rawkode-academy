import type { D1Database } from "@cloudflare/workers-types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { addCastingCredit } from "../data-model/integrations/zod";
import * as schema from "../data-model/schema";

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/", async (c) => {
	const db = drizzle(c.env.DB, { schema });

	const newCastingCredit = addCastingCredit.safeParse(await c.req.json());

	if (newCastingCredit.success === false) {
		return c.json({ error: newCastingCredit.error.flatten() }, { status: 400 });
	}

	const { personId, role, videoId } = newCastingCredit.data;

	try {
		// Check if casting credit already exists
		const existing = await db
			.select()
			.from(schema.castingCreditsTable)
			.where(
				and(
					eq(schema.castingCreditsTable.personId, personId),
					eq(schema.castingCreditsTable.role, role),
					eq(schema.castingCreditsTable.videoId, videoId),
				),
			)
			.get();

		if (existing) {
			return c.json(
				{ error: "Casting credit already exists", existing },
				{ status: 409 },
			);
		}

		const result = await db
			.insert(schema.castingCreditsTable)
			.values({
				personId,
				role,
				videoId,
			})
			.returning()
			.get();

		return c.json(
			{
				success: true,
				message: "Casting credit created successfully",
				data: result,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating casting credit:", error);
		return c.json(
			{ error: "Failed to create casting credit" },
			{ status: 500 },
		);
	}
});

export default app;
