const GRAPHQL_ENDPOINT = "https://api.rawkode.academy/graphql";
const LIMIT = 5;

async function fetchVideos(offset: number): Promise<any[]> {
  const query = `
    query GetLatestVideos($limit: Int!, $offset: Int!) {
      getLatestVideos(limit: $limit, offset: $offset) {
        id
        title
        technologies {
          id
          terms {
            term
          }
        }
      }
    }
  `;

  const variables = {
    limit: LIMIT,
    offset: offset,
  };

  console.log(`Fetching videos with offset: ${offset}`);

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
        console.error("GraphQL Errors:", result.errors);
        return []; // Treat GraphQL errors as potentially stopping condition or handle differently
    }

    const videos = result?.data?.getLatestVideos;
    if (!videos || !Array.isArray(videos)) {
        console.error("Unexpected response structure:", result);
        return []; // Stop if the structure is not as expected
    }

    console.log(`Fetched ${videos.length} videos.`);
    return videos;

  } catch (error) {
    console.error("Error fetching videos:", error);
    // Decide if you want to retry or stop on fetch errors
    // For now, we stop the process on error
    return [];
  }
}

const RESTATE_TRANSCRIPTION_BASE_ENDPOINT = "https://201j3n9npdrybn7f2z8tmnj8rds.env.us.restate.cloud:8080/transcription/transcribeVideoById";

async function triggerTranscription(videoId: string, apiKey: string, delay: string): Promise<void> {
    const endpointUrl = `${RESTATE_TRANSCRIPTION_BASE_ENDPOINT}/send?delay=${delay}`;
    console.log(`Scheduling transcription for video ID: ${videoId} with delay ${delay} to ${endpointUrl}`);
    try {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ videoId: videoId, language: "en" }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error scheduling transcription for ${videoId}: ${response.status} - ${errorBody}`);
        } else {
            console.log(`Successfully scheduled transcription for video ID: ${videoId} with delay ${delay}`);
            // Optionally process the response body if needed
            // const result = await response.json();
        }
    } catch (error) {
        console.error(`Network or other error scheduling transcription for ${videoId}:`, error);
    }
}


async function main() {
  const restateApiKey = Deno.env.get("RESTATE_API_KEY");
  if (!restateApiKey) {
    console.error("Error: RESTATE_API_KEY environment variable is not set.");
    Deno.exit(1);
  }

  let offset = 0;
  let keepFetching = true;

  while (keepFetching) {
    const videos = await fetchVideos(offset);

    if (videos.length === 0) {
      console.log("No more videos found. Stopping.");
      keepFetching = false;
    } else {
      // Calculate delay for this batch
      let delay: string;
      if (offset === 0) {
        delay = "PT10S"; // 10 seconds for the first batch
      } else {
        const delayMinutes = (offset / LIMIT) * 10;
        delay = `PT${delayMinutes}M`; // PT10M, PT20M, etc.
      }

      // Schedule transcription for each video with the calculated delay
      console.log(`Processing ${videos.length} videos for transcription scheduling with delay ${delay}...`);
      for (const video of videos) {
        if (video && video.id) {
            // No await here, let the requests fire off without waiting for each one
            triggerTranscription(video.id, restateApiKey, delay);
        } else {
            console.warn("Found video without ID in batch, skipping transcription scheduling:", video);
        }
      }

      // Prepare for the next fetch immediately (no sleep)
      offset += LIMIT;
      console.log(`Preparing for next fetch (offset: ${offset}).`);
      // Removed sleep call
    }
  }

  console.log("Finished fetching all videos.");
}

main();
