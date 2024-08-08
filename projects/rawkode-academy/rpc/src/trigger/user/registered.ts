import { logger, task, wait } from "@trigger.dev/sdk/v3";
import type { UserCreatedEvent } from "@workos-inc/node";

export const userRegistered = task({
	id: "user.registered",
	run: async (payload: UserCreatedEvent, { ctx }) => {
		logger.log(`Hello, ${payload.data.email}!`, { payload, ctx });

		await wait.for({ seconds: 5 });

		return {
			message: "Hello, world!",
		};
	},
});
