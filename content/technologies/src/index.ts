import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";
import { statSync } from "node:fs";
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

export type TechnologyStatus = (typeof TECHNOLOGY_STATUS_VALUES)[number];
export const technologyStatusEnum = zod.enum(technologyStatusEnumValues);

// Pure Zod schema for cross-environment validation & type inference
export const technologyZod = zod.object({
  // Core identity
  name: zod.string(),
  description: zod.string(),

  // Presentation
  icon: zod.string(),

  // Links
  website: zod.string(),
  source: zod.string().optional(),
  documentation: zod.string().optional(),

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
export function createSchema(z: typeof zod, _helpers?: { image?: (opts?: any) => any }) {
  return z.object({
    // Core identity
    name: z.string(),
    description: z.string(),

    // Presentation: keep as string to avoid image metadata parsing issues with some SVGs.
    // Accept either remote URLs or relative paths ("./logo.svg").
    icon: z.string(),

    // Links
    website: z.string(),
    source: z.string().optional(),
    documentation: z.string().optional(),

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

// Resolve the absolute directory for data files inside this package.
// Prefers the `data/` subdirectory if present; falls back to the package root
// to remain compatible with existing JSON files at the package root.
export async function resolveDataDir(): Promise<string> {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content-technologies/package.json");
  const root = dirname(pkgPath);
  const dataDir = join(root, "data");
  try {
    const s = await stat(dataDir);
    if (s.isDirectory()) return dataDir;
  } catch {}
  return root;
}

export function resolveDataDirSync(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content-technologies/package.json");
  const root = dirname(pkgPath);
  const dataDir = join(root, "data");
  try {
    const s = statSync(dataDir);
    if (s.isDirectory()) return dataDir;
  } catch {}
  return root;
}
