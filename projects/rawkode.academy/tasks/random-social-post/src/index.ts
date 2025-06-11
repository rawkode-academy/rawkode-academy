import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {
	SocialPlatforms,
	fetchRandomVideos,
	generateSocialPost,
	publishToSocialPlatform,
} from "./steps";

type Params = {
	email: string;
	metadata: Record<string, string>;
};

export class RandomVideoSocialPost extends WorkflowEntrypoint<Env, Params> {
	async run(_event: WorkflowEvent<Params>, step: WorkflowStep) {
		const videos = await step.do("queryRandomVideo", fetchRandomVideos);

		if (videos.length === 0) {
			return;
		}

		const platforms = Object.values(SocialPlatforms);

		const socialPosts = await Promise.all(
			platforms.map((platform) =>
				step.do(`generateSocialPost: ${platform}`, () =>
					generateSocialPost(videos[0], platform, this.env.AI),
				),
			),
		);

		const publishResults = await Promise.all(
			socialPosts.map((post) =>
				step.do(`publishToSocialPlatform: ${post.platform}`, () =>
					publishToSocialPlatform(post, this.env),
				),
			),
		);

		return { socialPosts, publishResults };
	}
}

export default {
	async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
		const instance = await env.RandomVideoSocialPost.create();
		console.log(`Started workflow ${instance.id}`);
	},
};
