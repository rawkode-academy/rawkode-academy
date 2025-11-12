import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";
import { createSchema as createTechnologySchema, resolveDataDirSync as resolveTechnologiesDataDir } from "@rawkodeacademy/content-technologies";

// Local, file-based content collections for videos, shows, and technologies.
// These are populated by scripts/sync-graphql-content.ts during build or on demand.

const videos = defineCollection({
  loader: glob({ pattern: ["**/*.{md,mdx}"], base: "./content/videos" }),
  schema: z.object({
    id: z.string(), // canonical slug identifier
    slug: z.string(), // kept for compatibility; equals id
    videoId: z.string(), // source/asset id for streams, captions, etc.
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    duration: z.number().nonnegative().optional(),
    // streamUrl/thumbnailUrl/duration are derived at runtime
    // Technologies: accept plain ids (e.g., "docker") or full entry ids ("docker/index"),
    // normalize to "<id>/index" for internal use, and verify existence.
    technologies: z
      .array(reference("technologies")).or(z.array(z.string()))
      .transform((arr) => arr.map((v: any) => (typeof v === 'string' ? (v.endsWith('/index') ? v : `${v}/index`) : v)))
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
  }),
});

const shows = defineCollection({
  loader: glob({ pattern: ["**/*.{md,mdx}"], base: "./content/shows" }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    hosts: z.array(reference("people")).default([]),
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
		pattern: ["**/*.{md,mdx}"],
		base: resolveTechnologiesDataDir(),
	}),
	schema: createTechnologySchema(z),
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

const learningPaths = defineCollection({
	loader: glob({
		pattern: ["**/*.md", "**/*.mdx"],
		base: "./content/learning-paths",
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		difficulty: z.enum(["beginner", "intermediate", "advanced"]),
		estimatedDuration: z.number(), // in minutes
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
	adrs,
	testimonials,
	courses,
	courseModules,
	changelog,
	learningPaths,
};
