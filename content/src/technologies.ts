import { z as zod } from "zod";

export const TECHNOLOGY_STATUS_VALUES = [
  "alpha",
  "beta",
  "stable",
  "preview",
  "superseded",
  "deprecated",
  "abandoned",
] as const;

const technologyStatusEnumValues = [...TECHNOLOGY_STATUS_VALUES] as [
  (typeof TECHNOLOGY_STATUS_VALUES)[number],
  ...(typeof TECHNOLOGY_STATUS_VALUES)[number][]
];

export const DEFAULT_TECHNOLOGY_STATUS: (typeof TECHNOLOGY_STATUS_VALUES)[number] = "stable";
export const DEFAULT_TECHNOLOGY_LICENSE = "Unknown";

export type TechnologyStatus = (typeof TECHNOLOGY_STATUS_VALUES)[number];
export const technologyStatusEnum = zod.enum(technologyStatusEnumValues);

// Pure Zod schema for cross-environment validation & type inference
export const technologyZod = zod.object({
  // Core identity
  name: zod.string(),
  description: zod.string(),

  // Presentation - logos available for this technology
  // YAML parses empty `logos:` as null, so we accept null and transform to undefined
  logos: zod
    .object({
      icon: zod.any().optional(),
      horizontal: zod.any().optional(),
      stacked: zod.any().optional(),
    })
    .nullish(),

  // Links
  website: zod.string(),
  source: zod.string().optional(),
  documentation: zod.string().optional(),
  license: zod.string().default(DEFAULT_TECHNOLOGY_LICENSE),

  // Taxonomy / relationships
  categories: zod.array(zod.string()).default([]),
  aliases: zod.array(zod.string()).optional(),
  relatedTechnologies: zod.array(zod.string()).optional(),

  // Content hints
  useCases: zod.array(zod.string()).optional(),
  features: zod.array(zod.string()).optional(),
  learningResources: zod
    .object({
      official: zod.array(zod.string()).optional(),
      community: zod.array(zod.string()).optional(),
      tutorials: zod.array(zod.string()).optional(),
    })
    .optional(),

  // Lifecycle
  status: technologyStatusEnum.default(DEFAULT_TECHNOLOGY_STATUS),
});

export type TechnologyData = zod.infer<typeof technologyZod>;

// Export a schema factory colocated with the content package.
// Consumers (e.g., the website's content config) will call this with their `z`.
export function createTechnologySchema(z: typeof zod, helpers?: { image?: () => any }) {
  const imageSchema = helpers?.image ? helpers.image() : z.string();

  return z.object({
    // Core identity
    name: z.string(),
    description: z.string(),

    // Presentation - logos available for this technology
    // Files are expected at ./icon.svg, ./horizontal.svg, ./stacked.svg
    // YAML parses empty `logos:` as null, so we accept null and transform to undefined
    logos: z
      .object({
        icon: imageSchema.optional(),
        horizontal: imageSchema.optional(),
        stacked: imageSchema.optional(),
      })
      .nullish(),

    // Links
    website: z.string(),
    source: z.string().optional(),
    documentation: z.string().optional(),
    license: z.string().default(DEFAULT_TECHNOLOGY_LICENSE),

    // Taxonomy / relationships
    categories: z.array(z.string()).default([]),
    aliases: z.array(z.string()).optional(),
    relatedTechnologies: z.array(z.string()).optional(),

    // Content hints
    useCases: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    learningResources: z
      .object({
        official: z.array(z.string()).optional(),
        community: z.array(z.string()).optional(),
        tutorials: z.array(z.string()).optional(),
      })
      .optional(),

    // Lifecycle
    status: z.enum(technologyStatusEnumValues).default(DEFAULT_TECHNOLOGY_STATUS),
  });
}
