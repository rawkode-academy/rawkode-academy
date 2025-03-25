import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

import { gql, GraphQLClient } from "graphql-request";

const graphQLClient = new GraphQLClient("https://api.rawkode.academy/graphql");

// We'll get the latest 400, which should be all or almost all
// Anything else can be fetched dynamically
const graphQLQuery = gql`
	query {
		videos: getLatestVideos(limit: 400) {
			id
			slug
			title
			subtitle
			description
			publishedAt
			streamUrl
			thumbnailUrl
			duration
		}
	}
`;

const videos = defineCollection({
	loader: async () => {
		const { videos }: any = await graphQLClient.request(graphQLQuery);

		return videos;
	},
	schema: z.object({
		id: z.string(),
		slug: z.string(),
		title: z.string(),
		subtitle: z.string().optional(),
		description: z.string(),
		streamUrl: z.string(),
		publishedAt: z.string(),
		thumbnailUrl: z.string(),
		duration: z.number(),
	}),
});

// HINT: image() is described here -> https://docs.astro.build/en/guides/images/#images-in-content-collections

const people = defineCollection({
		loader: glob({
		pattern: ["**\/*.json"],
		base: "./content/people",
	}),
	schema: z.object({
		name: z.string(),
		handle: z.string(),
	}),
});

const blog = defineCollection({
	loader: glob({
		pattern: ["**\/*.mdx", "**\/*.md"],
		base: "./content/blog",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			cover: z.object({
				image: image(),
				alt: z.string(),
			}).optional(),
			series: reference("series").optional(),
			subtitle: z.string().optional(),
			publishedAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			isDraft: z.boolean().default(true),
			authors: z.array(reference('people')).default(['rawkode']),
		}),
});

const series = defineCollection({
	loader: glob({
		pattern: ["**\/*.mdx"],
		base: "./content/series",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			cover: z.object({
				image: image(),
				alt: z.string(),
			}).optional(),
		}),
});

export const collections = { blog, series, videos, people };
