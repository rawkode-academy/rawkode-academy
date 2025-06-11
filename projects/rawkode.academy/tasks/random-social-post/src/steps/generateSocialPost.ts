import z from "zod/v4";
import type { RandomVideo } from "./fetchRandomVideo";

export enum SocialPlatforms {
	BlueSky = "BlueSky",
	LinkedIn = "LinkedIn",
	Zulip = "Zulip",
}

export const GeneratedSocialPost = z.object({
	post: z.string(),
});

export const AiResponse = z.object({
	response: GeneratedSocialPost,
});

export const StepResponse = z.object({
	platform: z.nativeEnum(SocialPlatforms),
	post: GeneratedSocialPost,
	video: z.object({
		url: z.string(),
		thumbnailUrl: z.string(),
		title: z.string(),
	}),
});

/**
 * Generates a social media post using Workers AI.
 *
 * @param video The video to generate a social media post for.
 * @param platform The social media platform to generate the post for.
 * @param ai The AI binding.
 * @returns A promise that resolves to the generated social media post.
 * @throws An error if the AI request fails.
 */
export async function generateSocialPost(
	video: RandomVideo,
	platform: SocialPlatforms,
	ai: Env["AI"],
): Promise<z.infer<typeof StepResponse>> {
	try {
		console.log(
			`Generating social media post for ${platform} for video: ${video.title}`,
		);

		const promptTemplate = await import(
			`../prompts/${platform.toLowerCase()}.txt`
		);
		const prompt = promptTemplate.default;

		const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
			prompt: `
				This video was in the past. It is not coming soon. We're merely resharing this.

				David McKay changed his name, he is now David Flanagan.

				Replace any mention of David Flanagan with @rawkode.dev

				Do not include the link in the post.

				Do not include hashtags in the post.

				Never mention a video is sponsored.

				Never include a placeholder for text to be replaced.

				Emojis encouraged!

				${prompt}

				Video Title: ${video.title}
				Video publishedAt: ${video.publishedAt}
				Video Description: ${video.description}
				Video Duration (Seconds): ${video.duration}
				Video is about the following technologies: ${video.technologies.join(", ")}
			`,
			stream: false,
			response_format: {
				type: "json_schema",
				json_schema: z.toJSONSchema(GeneratedSocialPost),
			},
		});

		console.log(
			`Generated response for ${platform}: ${JSON.stringify(response)}`,
		);

		const generatedPost = AiResponse.parse(response);
		return StepResponse.parse({
			platform,
			post: generatedPost.response,
			video: {
				url: `https://rawkode.academy/watch/${video.slug}`,
				thumbnailUrl: video.thumbnailUrl,
				title: video.title,
			},
		});
	} catch (e) {
		console.error(`Failed to generate social media post for ${platform}`, e);
		throw e;
	}
}
