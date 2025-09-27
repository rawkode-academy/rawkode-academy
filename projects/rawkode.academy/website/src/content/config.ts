import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

import { gql, GraphQLClient } from "graphql-request";
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

      episode {
        show {
          id
          name
          hosts {
            forename
            surname
          }
        }
      }
    }
  }
`;

interface GraphQLVideoShowHost {
        forename: string;
        surname: string;
}

interface GraphQLVideoShow {
        id: string;
        name: string;
        hosts?: GraphQLVideoShowHost[] | null;
}

interface GraphQLVideo {
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
        episode?: {
                show?: GraphQLVideoShow | null;
        } | null;
}

interface GraphQLResponse {
        videos: GraphQLVideo[];
}

const videos = defineCollection({
        loader: async () => {
                try {
                        const { videos }: GraphQLResponse =
                                await graphQLClient.request(graphQLQuery);

                        return videos.map(({ episode, ...video }) => ({
                                ...video,
                                show: episode?.show
                                        ? {
                                                  id: episode.show.id,
                                                  name: episode.show.name,
                                                  hosts:
                                                          episode.show.hosts?.map((host) => ({
                                                                  forename: host.forename,
                                                                  surname: host.surname,
                                                          })) ?? [],
                                          }
                                        : undefined,
                        }));
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
                show: z
                        .object({
                                id: z.string(),
                                name: z.string(),
                                hosts: z.array(
                                        z.object({
                                                forename: z.string(),
                                                surname: z.string(),
                                        }),
                                ),
                        })
                        .optional(),
        }),
});

// HINT: image() is described here -> https://docs.astro.build/en/guides/images/#images-in-content-collections

// Shared resource schema for courses and course modules
const resourceSchema = z.object({
	id: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	type: z.enum(["url", "file", "embed"]),
	url: z.string().url().optional(),
	filePath: z.string().optional(),
	embedConfig: z
		.object({
			container: z.enum(["webcontainer", "iframe"]),
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
		pattern: ["**/*.{md,mdx}"],
		base: "./content/articles",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			// canonicalUrl: z.string().url().optional(),
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
			// Additional properties that are used in components
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
		pattern: ["**/*.json"],
		base: "./content/technologies",
	}),
	schema: z.object({
		name: z.string(),
		description: z.string(),
		icon: z.string(),
		website: z.string().url(),
		source: z.string().url(),
		documentation: z.string().url(),
		categories: z.array(z.string()),
		aliases: z.array(z.string()).optional(),
		relatedTechnologies: z.array(z.string()).optional(),
		useCases: z.array(z.string()).optional(),
		features: z.array(z.string()).optional(),
		learningResources: z.object({
			official: z.array(z.string().url()).optional(),
			community: z.array(z.string().url()).optional(),
			tutorials: z.array(z.string().url()).optional(),
		}),
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
					youtube: z.string().optional(),
					rawkode: z.string().optional(),
					poster: z.string().optional(),
				})
				.optional(),
			duration: z.number().optional(), // Duration in minutes
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

const changelog = defineCollection({
	loader: glob({
		pattern: ["**/*.md", "**/*.mdx"],
		base: "./content/changelog",
	}),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		type: z.enum(["feature", "fix", "improvement", "breaking"]),
		description: z.string(),
		pullRequest: z.number().optional(),
		author: reference("people"),
	}),
});

export const collections = {
	videos,
	people,
	articles,
	technologies,
	series,
	adrs,
	testimonials,
	courses,
	courseModules,
	changelog,
};
