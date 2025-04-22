import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import { type GraphQLSchema } from "graphql";
import { db } from "../data-model/client.ts";
import * as dataSchema from "../data-model/schema.ts";

export interface PothosTypes {
  DrizzleSchema: typeof dataSchema;
}

const builder = new schemaBuilder<PothosTypes>({
  plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
  drizzle: {
    client: db,
  },
});

const videoRef = builder.externalRef(
  "Video",
  builder.selection<{ id: string }>("id"),
).implement({
  externalFields: (t) => ({
    id: t.string(),
  }),
  fields: (t) => ({
    technologies: t.field({
      type: [technologyRef],
      resolve: (video) =>
        db.select({
          id: dataSchema.videoTechnologiesTable.technologyId,
        }).from(dataSchema.videoTechnologiesTable).where(
          eq(dataSchema.videoTechnologiesTable.videoId, video.id),
        ),
    }),
  }),
});

const technologyRef = builder.externalRef(
  "Technology",
  builder.selection<{ id: string }>("id"),
).implement({
  externalFields: (t) => ({
    id: t.string(),
  }),
  fields: (t) => ({
    videos: t.field({
      type: [videoRef],
      resolve: (technology) =>
        db.select({
          id: dataSchema.videoTechnologiesTable.videoId,
        }).from(dataSchema.videoTechnologiesTable).where(
          eq(dataSchema.videoTechnologiesTable.technologyId, technology.id),
        ),
    }),
  }),
});

export const getSchema = (): GraphQLSchema => {
  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@extends", "@external", "@key"],
  });
};
