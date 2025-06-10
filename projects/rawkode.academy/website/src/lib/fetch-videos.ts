interface Video {
  slug: string;
  publishedAt: string;
}

export async function fetchVideosFromGraphQL(): Promise<Video[]> {
  try {
    const response = await fetch("https://api.rawkode.academy/graphql", {
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

    const data = await response.json();
    
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