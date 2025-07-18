import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

import { GraphQLClient, gql } from "graphql-request";
import { GRAPHQL_ENDPOINT } from "astro:env/server";

const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT);

// We'll get the latest 400, which should be all or almost all
// Anything else can be fetched dynamically
const graphQLQuery = gql`
  query {
    videos: getLatestVideos(limit: 400) {
      id
      slug
      title
      subtitle
      description
      publishedAt
      streamUrl
      thumbnailUrl
      duration

      technologies {
        id
        name
        logo
      }
    }
  }
`;

interface Video {
	id: string;
	slug: string;
	title: string;
	subtitle?: string;
	description: string;
	publishedAt: string;
	streamUrl: string;
	thumbnailUrl: string;
	duration: number;
	technologies: Array<{
		id: string;
		name: string;
		logo: string;
	}>;
}

interface GraphQLResponse {
	videos: Video[];
}

const videos = defineCollection({
	loader: async () => {
		try {
			const { videos }: GraphQLResponse =
				await graphQLClient.request(graphQLQuery);

			return videos;
		} catch (error) {
			console.warn("Failed to fetch videos from GraphQL API:", error);
			// Return empty array when GraphQL API is not accessible (e.g., during CI builds)
			return [];
		}
	},
	schema: z.object({
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		subtitle: z.string().optional(),
		description: z.string(),
		streamUrl: z.string(),
		publishedAt: z.string(),
		thumbnailUrl: z.string(),
		duration: z.number(),
		technologies: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				logo: z.string(),
			}),
		),
	}),
});

// HINT: image() is described here -> https://docs.astro.build/en/guides/images/#images-in-content-collections

// Shared resource schema for courses and course modules
const resourceSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	type: z.enum(["url", "file", "embed"]),
	url: z.string().url().optional(),
	filePath: z.string().optional(),
	embedConfig: z
		.object({
			container: z.enum([
				"stackblitz",
				"codesandbox",
				"codepen",
				"iframe",
				"webcontainer",
			]),
			src: z.string(),
			height: z.string().default("600px"),
			width: z.string().default("100%"),
			files: z.record(z.string()).optional(), // For WebContainer file system
			import: z
				.object({
					localDir: z.string(), // Path relative to the content file
				})
				.optional(),
			startCommand: z.string().optional(), // Command to run in WebContainer
		})
		.optional(),
	category: z
		.enum(["slides", "code", "documentation", "demos", "other"])
		.default("other"),
});

const people = defineCollection({
	loader: glob({
		pattern: ["**/*.json"],
		base: "./content/people",
	}),
	schema: z.object({
		name: z.string(),
		handle: z.string(),
	}),
});

const articles = defineCollection({
	loader: glob({
		pattern: ["**/*.mdx", "**/*.md"],
		base: "./content/articles",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			type: z
				.enum([
					"tutorial", // Step-by-step implementation guides
					"architecture", // System design and patterns
					"tools", // Tool reviews and introductions
					"practices", // Best practices and advice
					"features", // Deep dives into specific features
					"news", // News and announcements
					"case-study", // Real-world implementations
					"editorial", // Opinion pieces and editorials
				])
				.default("tutorial"),
			openGraph: z.object({
				title: z.string(),
				subtitle: z.string(),
			}),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			series: reference("series").optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			updates: z
				.array(
					z.object({
						date: z.coerce.date(),
						reason: z.string(),
					}),
				)
				.optional(),
			isDraft: z.boolean().default(true),
			authors: z.array(reference("people")).default(["rawkode"]),
			technologies: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
		}),
});

const series = defineCollection({
	loader: glob({
		pattern: ["**/*.mdx"],
		base: "./content/series",
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

const adrs = defineCollection({
	loader: glob({
		pattern: ["**/*.md"],
		base: "./content/adrs",
	}),
	schema: () =>
		z.object({
			title: z.string(),
			adoptedAt: z.coerce.date(),
			authors: z.array(reference("people")).default(["rawkode"]),
		}),
});

const testimonials = defineCollection({
	loader: glob({
		pattern: ["**/*.yaml", "**/*.yml"],
		base: "./content/testimonials",
	}),
	schema: z.object({
		quote: z.string(),
		author: z.object({
			name: z.string(),
			title: z.string(),
			image: z.string(),
			link: z.string().optional(),
		}),
		type: z.enum(["maintainer", "partner", "consulting", "viewer"]),
	}),
});

const courses = defineCollection({
	loader: glob({
		pattern: ["*.mdx", "*.md"],
		base: "./content/courses",
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
		base: "./content/courses",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			course: reference("courses"),
			section: z.string().optional(), // For grouping modules into sections
			order: z.number(), // For sorting modules within a course
			video: z
				.object({
					id: z.string(),
					thumbnailUrl: z.string().optional(),
				})
				.optional(),
			cover: z
				.object({
					image: image(),
					alt: z.string(),
				})
				.optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			isDraft: z.boolean().default(true),
			authors: z.array(reference("people")).default(["rawkode"]),
			resources: z.array(resourceSchema).optional(),
		}),
});

const changelog = defineCollection({
	loader: glob({
		pattern: ["**/*.md", "**/*.mdx"],
		base: "./content/changelog",
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		type: z.enum(["feature", "fix", "chore", "docs", "breaking"]),
		date: z.coerce.date(),
		author: z.string(),
	}),
});

export const collections = {
	adrs,
	articles,
	series,
	videos,
	people,
	testimonials,
	courses,
	courseModules,
	changelog,
};
