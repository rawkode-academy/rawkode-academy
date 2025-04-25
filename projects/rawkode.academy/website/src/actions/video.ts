import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

// Import getSecret conditionally to avoid client-side errors
let getSecret: (key: string) => string | undefined;
try {
  const envServer = await import("astro:env/server");
  getSecret = envServer.getSecret;
} catch (error) {
  // Fallback for client-side or when module is not available
  getSecret = () => undefined;
}

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

      const influxDB = new InfluxDBClient({
        host: influxDBUrl,
        token: influxDBToken,
        database: influxDBBucket,
      });

      let point = Point.measurement("event")
        .setTag("action", event.action)
        .setTag("videoId", event.videoId)
        .setTag("viewerId", "anonymous");

      switch (event.action) {
        case "video_started":
        case "video_paused":
        case "video_seeked":
          point.setField("seconds", event.seconds, "integer");
          break;
        case "video_progressed":
          point.setField("percent", event.percent, "float");
          break;
        case "video_completed":
          break;
      }

      await influxDB.write(point);
      await influxDB.close();

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
