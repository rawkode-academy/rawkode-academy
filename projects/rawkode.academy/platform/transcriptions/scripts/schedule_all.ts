const GRAPHQL_ENDPOINT = "https://api.rawkode.academy";
const LIMIT = 100;

interface Technology {
	id: string;
	terms: {
		term: string;
	}[];
}

interface Video {
	id: string;
	title: string;
	technologies: Technology[];
}

interface GraphQLResponse {
	data?: {
		getLatestVideos: Video[];
	};
	errors?: Array<{
		message: string;
		locations?: Array<{
			line: number;
			column: number;
		}>;
		path?: string[];
	}>;
}

async function fetchVideos(offset: number): Promise<Video[]> {
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
				Accept: "application/json",
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = (await response.json()) as GraphQLResponse;

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

async function triggerTranscription(id: string): Promise<void> {
	console.log(`Triggering transcription for video ID: ${id}`);
	try {
		const params = JSON.stringify({ id, language: "en" });
		const proc = Bun.spawn(
			["bunx", "wrangler", "workflows", "trigger", "transcribe", params],
			{ stdout: "pipe", stderr: "pipe" },
		);

		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(`Wrangler failed: ${stderr}`);
		}

		const match = output.match(/([a-f0-9-]{36})/i);
		console.log(
			`Successfully triggered transcription for video ID: ${id}, workflow ID: ${match?.[1] ?? "unknown"}`,
		);
	} catch (error) {
		console.error(
			`Error triggering transcription for ${id}:`,
			error instanceof Error ? error.message : error,
		);
	}
}

async function main() {
	let offset = 0;
	let keepFetching = true;
	let totalProcessed = 0;

	while (keepFetching) {
		const videos = await fetchVideos(offset);

		if (videos.length === 0) {
			console.log("No more videos found. Stopping.");
			keepFetching = false;
		} else {
			// Trigger transcription for each video
			console.log(`Processing ${videos.length} videos for transcription...`);

			// Process videos with a small delay between each to avoid overwhelming the endpoint
			for (let i = 0; i < videos.length; i++) {
				const video = videos[i];
				if (video?.id) {
					await triggerTranscription(video.id);
					totalProcessed++;

					// Add a small delay between requests (1 second)
					if (i < videos.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 1000));
					}
				} else {
					console.warn(
						"Found video without ID in batch, skipping transcription:",
						video,
					);
				}
			}

			// Prepare for the next fetch
			offset += LIMIT;
			console.log(
				`Processed ${totalProcessed} videos so far. Preparing for next fetch (offset: ${offset}).`,
			);

			// Add a delay between batches (5 seconds)
			if (keepFetching) {
				console.log("Waiting 5 seconds before next batch...");
				await new Promise((resolve) => setTimeout(resolve, 5000));
			}
		}
	}

	console.log(
		`Finished processing all videos. Total processed: ${totalProcessed}`,
	);
}

main();
