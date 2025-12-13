import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";
import { createTechnologySchema } from "@rawkodeacademy/content";
import { resolveContentDirSync } from "@rawkodeacademy/content/utils";

// Content collections mirroring the website but focused on content-only pages

const videos = defineCollection({
	loader: glob({
		pattern: ["**/*.{md,mdx}"],
		base: resolveContentDirSync("videos"),
	}),
	schema: z.object({
		id: z.string(),
		slug: z.string(),
		videoId: z.string(),
		title: z.string(),
		subtitle: z.string().optional(),
		description: z.string(),
		publishedAt: z.coerce.date(),
		duration: z.number().nonnegative().optional(),
		audioFileSize: z.number().positive().optional(),
		type: z.enum(["live", "recorded"]).optional(),
		category: z
			.enum(["editorial", "tutorial", "review", "interview", "announcement"])
			.optional(),
		technologies: z
			.array(reference("technologies"))
			.or(z.array(z.string()))
			.transform((arr) =>
				arr.map((v: any) =>
					typeof v === "string" ? (v.endsWith("/index") ? v : `${v}/index`) : v,
				),
			)
			.default([]),
		show: reference("shows").optional(),
		chapters: z
			.array(
				z.object({
					startTime: z.number().nonnegative(),
					title: z.string(),
				}),
			)
			.default([]),
		guests: z.array(reference("people")).default([]),
	}),
});

const shows = defineCollection({
	loader: glob({
		pattern: ["**/*.{md,mdx}"],
		base: resolveContentDirSync("shows"),
	}),
	schema: ({ image }) =>
		z.object({
			id: z.string(),
			name: z.string(),
			description: z.string().optional(),
			hosts: z.array(reference("people")).default([]),
			publish: z.boolean().default(false),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			podcast: z
				.object({
					guid: z.string().uuid().optional(),
					email: z.string().email(),
					category: z.string(),
					subcategory: z.string().optional(),
					explicit: z.boolean().default(false),
					copyright: z.string().optional(),
					artworkUrl: z.string().url().optional(),
				})
				.optional(),
			subscribeLinks: z
				.array(
					z.object({
						platform: z.string(),
						url: z.string().url(),
						icon: z
							.enum([
								"apple-podcasts",
								"spotify",
								"youtube",
								"pocket-casts",
								"amazon-music",
								"overcast",
								"rss",
								"other",
							])
							.default("other"),
					}),
				)
				.default([]),
		}),
});

const resourceSchema = z.object({
	id: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	type: z.enum(["url", "file", "embed"]),
	url: z.union([z.string().url(), z.string().startsWith("/")]).optional(),
	filePath: z.string().optional(),
	embedConfig: z
		.object({
			container: z.enum(["webcontainer", "iframe"]),
			src: z.string(),
			height: z.string().default("600px"),
			width: z.string().default("100%"),
			files: z.record(z.string()).optional(),
			import: z
				.object({
					localDir: z.string(),
				})
				.optional(),
			startCommand: z.string().optional(),
		})
		.optional(),
	category: z
		.enum(["slides", "code", "documentation", "demos", "other"])
		.default("other"),
});

const people = defineCollection({
	loader: glob({
		pattern: ["**/*.{md,mdx}"],
		base: resolveContentDirSync("people"),
	}),
	schema: z
		.object({
			name: z.string(),
			id: z.string(),
			github: z.string().optional(),
			twitter: z.string().optional(),
			bluesky: z.string().optional(),
			mastodon: z.string().url().optional(),
			linkedin: z.string().optional(),
			website: z.string().url().optional(),
			youtube: z.string().url().optional(),
			forename: z.string().optional(),
			surname: z.string().optional(),
			links: z
				.array(
					z.object({
						url: z.string().url(),
						name: z.string(),
					}),
				)
				.default([]),
		})
		.transform((person) => {
			const githubUrl = person.github
				? `https://github.com/${person.github}`
				: undefined;
			const twitterUrl = person.twitter
				? `https://x.com/${person.twitter}`
				: undefined;
			const blueskyUrl = person.bluesky
				? `https://bsky.app/profile/${person.bluesky}`
				: undefined;
			const linkedinUrl = person.linkedin
				? `https://www.linkedin.com/in/${person.linkedin}`
				: undefined;
			const avatarUrl = person.github
				? `https://github.com/${person.github}.png`
				: undefined;

			return {
				...person,
				github: githubUrl,
				twitter: twitterUrl,
				bluesky: blueskyUrl,
				linkedin: linkedinUrl,
				avatarUrl,
				handles: {
					github: person.github,
					twitter: person.twitter,
					bluesky: person.bluesky,
					linkedin: person.linkedin,
				},
			};
		}),
});

const articles = defineCollection({
	loader: glob({
		pattern: ["**/*.{md,mdx}"],
		base: resolveContentDirSync("articles"),
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			subtitle: z.string().optional(),
			description: z.string(),
			authors: z.array(reference("people")).default(["rawkode"]),
			categories: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			type: z
				.enum(["tutorial", "article", "guide", "news"])
				.default("tutorial"),
			series: reference("series").optional(),
			technologies: z.array(z.string()).optional(),
			openGraph: z
				.object({
					title: z.string(),
					subtitle: z.string().optional(),
				})
				.optional(),
			updates: z
				.array(
					z.object({
						date: z.coerce.date(),
						description: z.string(),
					}),
				)
				.optional(),
			resources: z.array(resourceSchema).optional(),
		}),
});

const technologies = defineCollection({
	loader: glob({
		pattern: ["**/*.{md,mdx}"],
		base: resolveContentDirSync("technologies"),
	}),
	schema: () => createTechnologySchema(z),
});

const series = defineCollection({
	loader: glob({
		pattern: ["**/*.mdx"],
		base: resolveContentDirSync("series"),
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
		}),
});

const courses = defineCollection({
	loader: glob({
		pattern: ["*.mdx", "*.md"],
		base: resolveContentDirSync("courses"),
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			authors: z.array(reference("people")).default(["rawkode"]),
			difficulty: z.enum(["beginner", "intermediate", "advanced"]),
			technologies: z
				.array(reference("technologies"))
				.or(z.array(z.string()))
				.transform((arr) =>
					arr.map((value: any) =>
						typeof value === "string"
							? value.endsWith("/index")
								? value
								: `${value}/index`
							: value,
					),
				)
				.default([]),
			resources: z.array(resourceSchema).optional(),
			signupConfig: z
				.object({
					audienceId: z.string(),
					sponsor: z.string().optional(),
					sponsorAudienceId: z.string().optional(),
					allowSponsorContact: z.boolean().default(false),
				})
				.optional(),
		}),
});

const courseModules = defineCollection({
	loader: glob({
		pattern: ["*/*.mdx", "*/*.md"],
		base: resolveContentDirSync("courses"),
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			course: reference("courses"),
			section: z.string().optional(),
			order: z.number(),
			video: z
				.object({
					id: z.string(),
					thumbnailUrl: z.string().optional(),
					youtube: z.string().optional(),
					rawkode: z.string().optional(),
					poster: z.string().optional(),
				})
				.optional(),
			duration: z.number().optional(),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			draft: z.boolean().default(true),
			difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
			authors: z.array(reference("people")).default(["rawkode"]),
			resources: z.array(resourceSchema).optional(),
		}),
});

const learningPaths = defineCollection({
	loader: glob({
		pattern: ["**/*.md", "**/*.mdx"],
		base: resolveContentDirSync("learning-paths"),
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		difficulty: z.enum(["beginner", "intermediate", "advanced"]),
		estimatedDuration: z.number(),
		prerequisites: z.array(z.string()).default([]),
		technologies: z.array(z.string()),
		publishedAt: z.coerce.date(),
		authors: z.array(reference("people")).default(["rawkode"]),
	}),
});

export const collections = {
	videos,
	shows,
	people,
	articles,
	technologies,
	series,
	courses,
	courseModules,
	learningPaths,
};
