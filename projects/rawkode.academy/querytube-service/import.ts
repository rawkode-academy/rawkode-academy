import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { youtubeVideoTable } from "./drizzle/schema";
import fs from "fs";
import csv from "csv-parser";

interface VideoData {
	"Video ID": string;
	"Approx Duration (ms)": string;
	"Video Audio Language": string;
	"Video Category": string;
	"Video Description (Original)": string;
	"Channel ID": string;
	"Tag 1": string;
	"Tag 2": string;
	"Tag 3": string;
	"Tag 4": string;
	"Tag 5": string;
	"Tag 6": string;
	"Tag 7": string;
	"Tag 8": string;
	"Tag 9": string;
	"Tag 10": string;
	"Video Title (Original)": string;
	Privacy: string;
	"Video State": string;
	"Video Create Timestamp": string;
	"Video Publish Timestamp": string;
}

const client = createClient({
	url: import.meta.env.TURSO_URL as string,
	authToken: import.meta.env.TURSO_TOKEN as string,
});

export const db = drizzle(client);

await migrate(db, {
	migrationsFolder: "./drizzle/migrations",
});

const loadCSV = (filePath: string): Promise<VideoData[]> => {
	const results: VideoData[] = [];

	return new Promise((resolve, reject) => {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on("data", (data: VideoData) => results.push(data))
			.on("end", () => resolve(results))
			.on("error", (error) => {
				console.log(`Error: ${error}`);
				reject(error);
			});
	});
};

const videos = await loadCSV("./yt-data/videos.csv");

console.log(`Loaded videos ${videos.length}`);

const seed = async (videos: VideoData[]) => {
	const chunkSize = 50;
	for (let i = 0; i < videos.length; i += chunkSize) {
		const chunk = videos.slice(i, i + chunkSize);
		chunk
			.filter((video) => video.Privacy === "Public")
			.map(async (video) => {
				console.debug(video);
				await db
					.insert(youtubeVideoTable)
					.values({
						id: video["Video ID"],
						title: video["Video Title (Original)"],
						streamedLive: false,
						date: new Date(
							video["Video Publish Timestamp"] ||
								video["Video Create Timestamp"]
						),
						description: video["Video Description (Original)"],
					})
					.returning()
					.all();
			});

		await new Promise((resolve) => setTimeout(resolve, 500));
	}
};

console.log("Seeding");
await seed(videos);
console.log("Done");

await client.close();
