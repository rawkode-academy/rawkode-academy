import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

import { GraphQLClient, gql } from "graphql-request";

const graphQLClient = new GraphQLClient("https://api.rawkode.academy/graphql");

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
		const { videos }: GraphQLResponse =
			await graphQLClient.request(graphQLQuery);

		return videos;
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
		pattern: ["**/*.mdx", "**/*.md"],
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
		}),
});

const courseModules = defineCollection({
	loader: glob({
		pattern: ["**/*.mdx", "**/*.md"],
		base: "./content/course-modules",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			course: reference("courses"),
			section: z.string().optional(), // For grouping modules into sections
			order: z.number(), // For sorting modules within a course
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
			videoUrl: z.string().optional(),
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
