import { Client } from "@temporalio/client";

import { getEnv } from "./env";
import { getClientConnection } from "./tls";
import { newEpisode } from "./workflows";

const run = async () => {
	const env = getEnv();
	const connection = await getClientConnection();

	const client = new Client({ connection, namespace: env.namespace });

	const result = await client.workflow.execute(newEpisode, {
		taskQueue: env.taskQueue,
		workflowId: `my-business-id-${Date.now()}`,
	});
	console.log(result);
};

run().then(
	() => process.exit(0),
	(err) => {
		console.error(err);
		process.exit(1);
	},
);
