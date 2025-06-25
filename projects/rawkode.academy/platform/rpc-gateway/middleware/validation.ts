import type { Context, Next } from "hono";
import { z } from "zod";
import type { RPCRequest } from "../bindings";

const RPCRequestSchema = z.object({
	service: z.string().min(1),
	resource: z.string().optional(),
	params: z.unknown().optional(),
});

export async function validateRequest(
	c: Context<{ Bindings: Env }>,
	next: Next,
) {
	try {
		const body = await c.req.json();
		const validated = RPCRequestSchema.parse(body);

		// Store validated request in context
		c.set("rpcRequest", validated);

		await next();
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid request format",
						details: error.errors,
					},
				},
				400,
			);
		}

		return c.json(
			{
				success: false,
				error: {
					code: "PARSE_ERROR",
					message: "Failed to parse request body",
				},
			},
			400,
		);
	}
}
