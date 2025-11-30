import { statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { z as zod } from "zod";
import { resolveContentDir } from "./index";

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

export const DEFAULT_TECHNOLOGY_STATUS: (typeof TECHNOLOGY_STATUS_VALUES)[number] =
  "stable";

export type TechnologyStatus = (typeof TECHNOLOGY_STATUS_VALUES)[number];
export const technologyStatusEnum = zod.enum(technologyStatusEnumValues);

export const technologyZod = zod.object({
  name: zod.string(),
  description: zod.string(),
  logos: zod
    .object({
      icon: zod.any().optional(),
      horizontal: zod.any().optional(),
      stacked: zod.any().optional(),
    })
    .nullish(),
  website: zod.string(),
  source: zod.string().optional(),
  documentation: zod.string().optional(),
  categories: zod.array(zod.string()).default([]),
  aliases: zod.array(zod.string()).optional(),
  relatedTechnologies: zod.array(zod.string()).optional(),
  useCases: zod.array(zod.string()).optional(),
  features: zod.array(zod.string()).optional(),
  learningResources: zod
    .object({
      official: zod.array(zod.string()).optional(),
      community: zod.array(zod.string()).optional(),
      tutorials: zod.array(zod.string()).optional(),
    })
    .optional(),
  status: technologyStatusEnum.default(DEFAULT_TECHNOLOGY_STATUS),
});

export type TechnologyData = zod.infer<typeof technologyZod>;

export function createSchema(z: typeof zod, helpers?: { image?: () => any }) {
  const imageSchema = helpers?.image ? helpers.image() : z.string();

  return z.object({
    name: z.string(),
    description: z.string(),
    logos: z
      .object({
        icon: imageSchema.optional(),
        horizontal: imageSchema.optional(),
        stacked: imageSchema.optional(),
      })
      .nullish(),
    website: z.string(),
    source: z.string().optional(),
    documentation: z.string().optional(),
    categories: z.array(z.string()).default([]),
    aliases: z.array(z.string()).optional(),
    relatedTechnologies: z.array(z.string()).optional(),
    useCases: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    learningResources: z
      .object({
        official: z.array(z.string()).optional(),
        community: z.array(z.string()).optional(),
        tutorials: z.array(z.string()).optional(),
      })
      .optional(),
    status: z.enum(technologyStatusEnumValues).default(DEFAULT_TECHNOLOGY_STATUS),
  });
}

const technologiesDir = resolveContentDir("technologies");
const technologiesDataDir = join(technologiesDir, "data");

export async function resolveDataDir(): Promise<string> {
  try {
    const s = await stat(technologiesDataDir);
    if (s.isDirectory()) return technologiesDataDir;
  } catch {}
  return technologiesDir;
}

export function resolveDataDirSync(): string {
  try {
    const s = statSync(technologiesDataDir);
    if (s.isDirectory()) return technologiesDataDir;
  } catch {}
  return technologiesDir;
}
