import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { getSecret } from "astro:env/server";

const VideoEventSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("video_started"),
		videoId: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("video_paused"),
		videoId: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("video_seeked"),
		videoId: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("video_completed"),
		videoId: z.string(),
	}),
	z.object({
		action: z.literal("video_progressed"),
		videoId: z.string(),
		percent: z.number(),
	}),
]);

export const trackVideoEvent = defineAction({
	input: VideoEventSchema,
	handler: async (event, _ctx) => {
		try {
			console.log("Video event received:", event);

			const influxDBUrl = getSecret("INFLUXDB_URL");
			const influxDBToken = getSecret("INFLUXDB_TOKEN");
			const influxDBOrg = getSecret("INFLUXDB_ORG");
			const influxDBBucket = getSecret("INFLUXDB_BUCKET");

			// Not configured, that's OK
			if (!influxDBUrl || !influxDBToken || !influxDBOrg || !influxDBBucket) {
				console.log(`InfluxDB not configured, skipping event`);
				return { success: true };
			}

			const influxDB = new InfluxDB({
				url: influxDBUrl,
				token: influxDBToken,
			});

			const writeApi = influxDB.getWriteApi(influxDBOrg, influxDBBucket);

			let point = new Point("event")
				.tag("action", event.action)
				.tag("videoId", event.videoId)
				.tag("viewerId", "anonymous");

			switch (event.action) {
				case "video_started":
				case "video_paused":
				case "video_seeked":
					point = point.intField("seconds", event.seconds);
					break;
				case "video_progressed":
					point = point.intField("percent", event.percent);
					break;
				case "video_completed":
					break;
			}

			writeApi.writePoint(point);

			await writeApi.flush();
			return {
				success: true as const,
			};
		} catch (error) {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: error instanceof Error
					? error.message
					: "Failed to process video event",
			});
		}
	},
});
