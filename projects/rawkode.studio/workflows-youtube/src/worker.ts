import { Worker, NativeConnection } from "@temporalio/worker";

import * as activities from "./activities";
import { getEnv } from "./env";
import { getConnection } from "./tls";

async function run() {
	const env = getEnv();

	const connection: NativeConnection | undefined = await getConnection();

	const worker = await Worker.create({
		connection,
		workflowsPath: require.resolve("./workflows"),
		activities,
		namespace: env.namespace,
		taskQueue: env.taskQueue,
	});

	console.log("Worker connection successfully established");

	await worker.run();

	if (connection) {
		await connection.close();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
