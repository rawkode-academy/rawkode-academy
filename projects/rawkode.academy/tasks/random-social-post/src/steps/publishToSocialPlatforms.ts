import { BskyAgent, RichText } from "@atproto/api";
import type { StepResponse } from "./generateSocialPost";
import { SocialPlatforms } from "./generateSocialPost";
import type { z } from "zod/v4";

interface PublishResult {
	platform: SocialPlatforms;
	success: boolean;
	postId?: string;
	error?: string;
}

async function publishToBluesky(
	socialPost: z.infer<typeof StepResponse>,
	env: Env,
): Promise<PublishResult> {
	try {
		const agent = new BskyAgent({
			service: "https://bsky.social",
		});

		await agent.login({
			identifier: env.BLUESKY_HANDLE,
			password: await env.BLUESKY_APP_PASSWORD.get(),
		});

		const richText = new RichText({ text: socialPost.post.post });
		await richText.detectFacets(agent);

		const thumbFetch = await fetch(socialPost.video.thumbnailUrl);
		const thumbBuffer = await thumbFetch.arrayBuffer();
		const thumbUpload = await agent.uploadBlob(new Uint8Array(thumbBuffer), {
			encoding: "image/jpeg",
		});

		const result = await agent.post({
			text: richText.text,
			facets: richText.facets,
			embed: {
				$type: "app.bsky.embed.external",
				external: {
					uri: socialPost.video.url,
					title: socialPost.video.title,
					description: "Watch on the Rawkode Academy",
					thumb: thumbUpload.data.blob,
				},
			},
		});

		return {
			platform: SocialPlatforms.BlueSky,
			success: true,
			postId: result.uri,
		};
	} catch (error) {
		console.error("BlueSky publishing error:", error);
		return {
			platform: SocialPlatforms.BlueSky,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

async function publishToLinkedIn(
	post: string,
	env: Env,
): Promise<PublishResult> {
	try {
		const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
			},
			body: JSON.stringify({
				author: `urn:li:person:${env.LINKEDIN_USER_ID}`,
				lifecycleState: "PUBLISHED",
				specificContent: {
					"com.linkedin.ugc.ShareContent": {
						shareCommentary: {
							text: post,
						},
						shareMediaCategory: "NONE",
					},
				},
				visibility: {
					"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
				},
			}),
		});

		if (!response.ok) {
			throw new Error(`LinkedIn post failed: ${response.statusText}`);
		}

		const result = await response.json() as {
			id: string;
		};

		return {
			platform: SocialPlatforms.LinkedIn,
			success: true,
			postId: result.id,
		};
	} catch (error) {
		console.error("LinkedIn publishing error:", error);
		return {
			platform: SocialPlatforms.LinkedIn,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function publishToSocialPlatform(
	socialPost: z.infer<typeof StepResponse>,
	env: Env,
): Promise<PublishResult> {
	const { platform } = socialPost;

	switch (platform) {
		case SocialPlatforms.BlueSky:
			return publishToBluesky(socialPost, env);
		// Pending LinkedIn Approval
		// case SocialPlatforms.LinkedIn:
			// return publishToLinkedIn(socialPost.post.post, env);
		default:
			return {
				platform,
				success: false,
				error: "Unsupported platform",
			};
	}
}
