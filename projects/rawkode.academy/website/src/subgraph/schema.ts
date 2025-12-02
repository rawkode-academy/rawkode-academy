import type { GraphQLSchema } from "graphql";
import SchemaBuilder from "@pothos/core";
import DirectivesPlugin from "@pothos/plugin-directives";
import FederationPlugin from "@pothos/plugin-federation";
import { registerTechnologies } from "./domains/technologies";
import { registerVideos } from "./domains/videos";
import { registerShows } from "./domains/shows";
import { registerPeople } from "./domains/people";
import { registerEpisodes } from "./domains/episodes";
import { registerChapters } from "./domains/chapters";
import { registerRelationships } from "./domains/relationships";

export function getSchema(): GraphQLSchema {
	// Fresh builder per call to withstand HMR and prevent duplicate type names.
	const builder = new SchemaBuilder({
		plugins: [DirectivesPlugin, FederationPlugin],
	});

	// Register core entity domains
	const { TechnologyRef } = registerTechnologies(builder);
	const { VideoRef } = registerVideos(builder);
	const { ShowRef } = registerShows(builder);
	const { PersonRef } = registerPeople(builder);

	// Register domains that extend core entities
	registerEpisodes(builder, { VideoRef, ShowRef });
	registerChapters(builder, { VideoRef });
	registerRelationships(builder, {
		VideoRef,
		ShowRef,
		PersonRef,
		TechnologyRef,
	});

	const schema = builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: [
			"@key",
			"@extends",
			"@external",
			"@provides",
			"@requires",
		],
	});

	// Pothos pulls GraphQL from the repo root, so cast to the local version expected by bundler tooling.
	return schema as unknown as GraphQLSchema;
}

export default getSchema;
