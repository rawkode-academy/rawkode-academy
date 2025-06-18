interface Video {
	slug: string;
	publishedAt: string;
}

export async function fetchVideosFromGraphQL(): Promise<Video[]> {
	try {
		// This function is called during build time in astro.config.mts,
		// so we can't use astro:env/server here
		const graphqlEndpoint =
			process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/graphql";
		const response = await fetch(graphqlEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: `
          query GetAllVideosForSitemap {
            getLatestVideos(limit: 1000) {
              slug
              publishedAt
            }
          }
        `,
			}),
		});

		if (!response.ok) {
			throw new Error(`GraphQL request failed: ${response.status}`);
		}

		const data: {
			data?: { getLatestVideos?: Video[] };
			errors?: any;
		} = await response.json();

		if (data.errors) {
			console.error("GraphQL errors:", data.errors);
			return [];
		}

		return data.data?.getLatestVideos || [];
	} catch (error) {
		console.error("Error fetching videos for sitemap:", error);
		return [];
	}
}
