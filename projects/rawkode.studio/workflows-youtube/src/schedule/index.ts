import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const { newEpisodeWorkflow } = proxyActivities<typeof activities>({
	retry: {
		initialInterval: "1 minute",
		maximumInterval: "2880 minutes",
		backoffCoefficient: 10,
	},
	startToCloseTimeout: "30 seconds",
});

export async function newEpisode(): Promise<string> {
	return await newEpisodeWorkflow();
}
