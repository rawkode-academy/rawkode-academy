import type { GraphQLSchema } from "graphql";
import SchemaBuilder from "@pothos/core";
import DirectivesPlugin from "@pothos/plugin-directives";
import FederationPlugin from "@pothos/plugin-federation";
import { registerTechnologies } from "./domains/technologies";

export function getSchema(): GraphQLSchema {
  // Fresh builder per call to withstand HMR and prevent duplicate type names.
  const builder = new SchemaBuilder({
    plugins: [DirectivesPlugin, FederationPlugin],
  });

  // Register all domain modules
  registerTechnologies(builder);

  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@key", "@extends", "@external", "@provides", "@requires"],
  });
}

export default getSchema;
