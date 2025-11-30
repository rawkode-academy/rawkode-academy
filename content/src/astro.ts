import type { CollectionConfig } from "astro:content";
import { technologies, resolveContentDir } from "./index";

export type CollectionFactoryDeps = {
  defineCollection: typeof import("astro:content").defineCollection;
  reference: typeof import("astro:content").reference;
  glob: typeof import("astro/loaders").glob;
  z: typeof import("astro:content").z;
};

export function createCollections({ defineCollection, reference, glob, z }: CollectionFactoryDeps) {
  const contentDir = (...segments: string[]) => resolveContentDir(...segments);

  const videos = defineCollection({
    loader: glob({ pattern: ["**/*.{md,mdx}"], base: contentDir("videos") }),
    schema: z.object({
      id: z.string(),
      slug: z.string(),
      videoId: z.string(),
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string(),
      publishedAt: z.coerce.date(),
      duration: z.number().nonnegative().optional(),
      technologies: z
        .array(reference("technologies"))
        .or(z.array(z.string()))
        .transform((arr) =>
          arr.map((v: any) => (typeof v === "string" ? (v.endsWith("/index") ? v : `${v}/index`) : v)),
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
    loader: glob({ pattern: ["**/*.{md,mdx}"], base: contentDir("shows") }),
    schema: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      hosts: z.array(reference("people")).default([]),
    }),
  });

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
        files: z.record(z.string()).optional(),
        import: z
          .object({
            localDir: z.string(),
          })
          .optional(),
        startCommand: z.string().optional(),
      })
      .optional(),
    category: z.enum(["slides", "code", "documentation", "demos", "other"]).default("other"),
  });

  const people = defineCollection({
    loader: glob({
      pattern: ["**/*.json"],
      base: contentDir("people"),
    }),
    schema: z.object({
      name: z.string(),
      handle: z.string(),
      forename: z.string().optional(),
      surname: z.string().optional(),
      biography: z.string().optional(),
      links: z
        .array(
          z.object({
            url: z.string().url(),
            name: z.string(),
          }),
        )
        .default([]),
    }),
  });

  const articles = defineCollection({
    loader: glob({
      pattern: ["**/*.{md,mdx}"],
      base: contentDir("articles"),
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
        type: z.enum(["tutorial", "article", "guide", "news"]).default("tutorial"),
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

  const technologiesCollection = defineCollection({
    loader: glob({
      pattern: ["**/*.{md,mdx}"],
      base: technologies.resolveDataDirSync(),
    }),
    schema: ({ image }) => technologies.createSchema(z, { image }),
  });

  const series = defineCollection({
    loader: glob({
      pattern: ["**/*.mdx"],
      base: contentDir("series"),
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
      base: contentDir("adrs"),
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
      base: contentDir("testimonials"),
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
      base: contentDir("courses"),
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
      base: contentDir("courses"),
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

  const changelog = defineCollection({
    loader: glob({
      pattern: ["**/*.md", "**/*.mdx"],
      base: contentDir("changelog"),
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
      base: contentDir("learning-paths"),
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

  return {
    videos,
    shows,
    people,
    articles,
    technologies: technologiesCollection,
    series,
    adrs,
    testimonials,
    courses,
    courseModules,
    changelog,
    learningPaths,
  } satisfies Record<string, CollectionConfig>;
}
