import { z as zod } from "zod";
import {
  CNCF_STATUS_VALUES,
  MATRIX_CONFIDENCE_VALUES,
  MATRIX_GROUPING_VALUES,
  MATRIX_STATUS_VALUES,
  MATRIX_TRAJECTORY_VALUES,
  TECHNOLOGY_STATUS_VALUES,
} from "./dimensions.js";

export {
  CNCF_STATUS_VALUES,
  MATRIX_CONFIDENCE_VALUES,
  MATRIX_GROUPING_VALUES,
  MATRIX_STATUS_VALUES,
  MATRIX_TRAJECTORY_VALUES,
  TECHNOLOGY_STATUS_VALUES,
};

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

  // Presentation - logos available for this technology
  // Booleans indicate whether icon.svg, horizontal.svg, stacked.svg exist
  // YAML parses empty `logos:` as null, so we accept null and transform to undefined
  logos: zod
    .object({
      icon: zod.boolean().optional(),
      horizontal: zod.boolean().optional(),
      stacked: zod.boolean().optional(),
    })
    .nullish(),

  // Links
  website: zod.string(),
  source: zod.string().optional(),
  documentation: zod.string().optional(),
  license: zod.string().default(DEFAULT_TECHNOLOGY_LICENSE),

  // CNCF Landscape Taxonomy (hierarchical category structure)
  category: zod.string().optional(),        // e.g., "Provisioning"
  subcategory: zod.string().optional(),     // e.g., "Automation & Configuration"

  // Relationships
  aliases: zod.array(zod.string()).optional(),
  relatedTechnologies: zod.array(zod.string()).optional(),

  // CNCF Project Metadata
  cncf: zod.object({
    // Project lifecycle status
    status: zod.enum([...CNCF_STATUS_VALUES] as [string, ...string[]]).optional(),

    // Timeline
    accepted: zod.string().optional(),        // ISO date string
    incubating: zod.string().optional(),
    graduated: zod.string().optional(),
    archived: zod.string().optional(),

    // External CNCF links
    devStatsUrl: zod.string().url().optional(),
    annualReviewUrl: zod.string().url().optional(),

    // Rich metadata from CNCF landscape
    personas: zod.array(zod.string()).optional(),         // Target users
    tags: zod.array(zod.string()).optional(),             // Categorical tags
    useCase: zod.string().optional(),                     // Primary use case
    businessUseCase: zod.string().optional(),             // Enterprise value prop
    releaseRate: zod.string().optional(),                 // Release cadence
    integrations: zod.array(zod.string()).optional(),     // Compatible systems
  }).optional(),

  // Community & Social Links (enriched from CNCF + our data)
  community: zod.object({
    twitter: zod.string().url().optional(),
    youtube: zod.string().url().optional(),
    slack: zod.string().url().optional(),
    discord: zod.string().url().optional(),
    chat: zod.string().optional(),                // Generic chat link
    blog: zod.string().url().optional(),
    mailingList: zod.string().url().optional(),
    githubDiscussions: zod.string().url().optional(),
  }).optional(),

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

  // Technology Matrix - Rawkode's opinionated take
  matrix: zod
    .object({
      grouping: zod.enum([...MATRIX_GROUPING_VALUES] as [string, ...string[]]).optional(),
      // Pipeline stages (left to right journey)
      status: zod.enum([...MATRIX_STATUS_VALUES] as [string, ...string[]]),
      // Confidence in this placement
      confidence: zod.enum([...MATRIX_CONFIDENCE_VALUES] as [string, ...string[]]).optional(),
      // Direction of travel
      trajectory: zod.enum([...MATRIX_TRAJECTORY_VALUES] as [string, ...string[]]).optional(),

      // Card back - the personal story
      firstUsed: zod.string().optional(),  // e.g., "2020-03"
      lastUsed: zod.string().optional(),   // e.g., "2024-11"
      makesMeFeel: zod.string().optional(), // emoji reaction
      why: zod.string().optional(),         // reasoning for placement
      spicyTake: zod.string().optional(),   // the hot take 🌶️
    })
    .optional(),
});

export type TechnologyData = zod.infer<typeof technologyZod>;

// Export a schema factory colocated with the content package.
// Consumers (e.g., the website's content config) will call this with their `z`.
export function createTechnologySchema(z: typeof zod) {
  return z.object({
    // Core identity
    name: z.string(),

    // Presentation - logos available for this technology
    // Booleans indicate whether icon.svg, horizontal.svg, stacked.svg exist
    // YAML parses empty `logos:` as null, so we accept null and transform to undefined
    logos: z
      .object({
        icon: z.boolean().optional(),
        horizontal: z.boolean().optional(),
        stacked: z.boolean().optional(),
      })
      .nullish(),

    // Links
    website: z.string(),
    source: z.string().optional(),
    documentation: z.string().optional(),
    license: z.string().default(DEFAULT_TECHNOLOGY_LICENSE),

    // CNCF Landscape Taxonomy (hierarchical category structure)
    category: z.string().optional(),        // e.g., "Provisioning"
    subcategory: z.string().optional(),     // e.g., "Automation & Configuration"

    // Relationships
    aliases: z.array(z.string()).optional(),
    relatedTechnologies: z.array(z.string()).optional(),

    // CNCF Project Metadata
    cncf: z.object({
      // Project lifecycle status
      status: z.enum([...CNCF_STATUS_VALUES] as [string, ...string[]]).optional(),

      // Timeline
      accepted: z.string().optional(),        // ISO date string
      incubating: z.string().optional(),
      graduated: z.string().optional(),
      archived: z.string().optional(),

      // External CNCF links
      devStatsUrl: z.string().url().optional(),
      annualReviewUrl: z.string().url().optional(),

      // Rich metadata from CNCF landscape
      personas: z.array(z.string()).optional(),         // Target users
      tags: z.array(z.string()).optional(),             // Categorical tags
      useCase: z.string().optional(),                     // Primary use case
      businessUseCase: z.string().optional(),             // Enterprise value prop
      releaseRate: z.string().optional(),                 // Release cadence
      integrations: z.array(z.string()).optional(),     // Compatible systems
    }).optional(),

    // Community & Social Links (enriched from CNCF + our data)
    community: z.object({
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
      slack: z.string().url().optional(),
      discord: z.string().url().optional(),
      chat: z.string().optional(),                // Generic chat link
      blog: z.string().url().optional(),
      mailingList: z.string().url().optional(),
      githubDiscussions: z.string().url().optional(),
    }).optional(),

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

    // Technology Matrix - Rawkode's opinionated take
    matrix: z
      .object({
        grouping: z.enum([...MATRIX_GROUPING_VALUES] as [string, ...string[]]).optional(),
        // Pipeline stages (left to right journey)
        status: z.enum([...MATRIX_STATUS_VALUES] as [string, ...string[]]),
        // Confidence in this placement
        confidence: z.enum([...MATRIX_CONFIDENCE_VALUES] as [string, ...string[]]).optional(),
        // Direction of travel
        trajectory: z.enum([...MATRIX_TRAJECTORY_VALUES] as [string, ...string[]]).optional(),

        // Card back - the personal story
        firstUsed: z.string().optional(),  // e.g., "2020-03"
        lastUsed: z.string().optional(),   // e.g., "2024-11"
        makesMeFeel: z.string().optional(), // emoji reaction
        why: z.string().optional(),         // reasoning for placement
        spicyTake: z.string().optional(),   // the hot take 🌶️
      })
      .optional(),
  });
}
