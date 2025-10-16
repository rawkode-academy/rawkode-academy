import type SchemaBuilder from "@pothos/core";
import type { TechnologyItem } from "../loaders/technologies";
import type { TechnologyData } from "@rawkodeacademy/content-technologies";
import { listTechnologies, getTechnologyById } from "../loaders/technologies";

export function registerTechnologies(builder: SchemaBuilder<{}>) {
  // LearningResources type derived from content schema
  type LearningResources = NonNullable<TechnologyData["learningResources"]>;
  const LearningResourcesRef = builder.objectRef<LearningResources>("LearningResources");
  builder.objectType(LearningResourcesRef, {
    fields: (t) => ({
      official: t.field({ type: ["String"], resolve: (lr) => lr?.official ?? [] }),
      community: t.field({ type: ["String"], resolve: (lr) => lr?.community ?? [] }),
      tutorials: t.field({ type: ["String"], resolve: (lr) => lr?.tutorials ?? [] }),
    }),
  });

  // Technology entity
  const TechnologyRef = builder.objectRef<TechnologyItem>("Technology");
  builder.objectType(TechnologyRef, {
    fields: (t) => ({
      id: t.exposeID("id"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      icon: t.field({ type: "String", nullable: true, resolve: (r) => r.icon ?? undefined }),
      // Back-compat alias: keep non-null like the old service
      logo: t.string({
        resolve: (r) => r.logo ?? r.icon ?? `https://content.rawkode.academy/logos/technologies/${r.id}.svg`,
      }),
      website: t.exposeString("website"),
      source: t.field({ type: "String", nullable: true, resolve: (r) => r.source ?? undefined }),
      // Keep non-null behavior by falling back to empty string
      documentation: t.string({ resolve: (r) => r.documentation ?? "" }),
      categories: t.field({ type: ["String"], resolve: (r) => r.categories ?? [] }),
      aliases: t.field({ type: ["String"], nullable: true, resolve: (r) => r.aliases ?? null }),
      relatedTechnologies: t.field({ type: ["String"], nullable: true, resolve: (r) => r.relatedTechnologies ?? null }),
      useCases: t.field({ type: ["String"], nullable: true, resolve: (r) => r.useCases ?? null }),
      features: t.field({ type: ["String"], nullable: true, resolve: (r) => r.features ?? null }),
      learningResources: t.field({ type: LearningResourcesRef, nullable: true, resolve: (r) => r.learningResources ?? null }),
      status: t.field({ type: "String", nullable: true, resolve: (r) => r.status ?? undefined }),
    }),
  });

  // Federation entity configuration (@key on id)
  builder.asEntity(TechnologyRef, {
    key: builder.selection<{ id: string }>("id"),
    resolveReference: async (ref) => getTechnologyById(ref.id),
  });

  // Only required query
  builder.queryType({
    fields: (t) => ({
      getTechnologies: t.field({
        type: [TechnologyRef],
        args: {
          limit: t.arg.int({ required: false, defaultValue: 15 }),
          offset: t.arg.int({ required: false, defaultValue: 0 }),
        },
        resolve: async (_root, args) => {
          const items = await listTechnologies();
          items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          const { limit = 15, offset = 0 } = args;
          return items.slice(offset, offset + limit);
        },
      }),
    }),
  });

  return { TechnologyRef };
}
