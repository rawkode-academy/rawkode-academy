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
    action: z.literal("played"),
    videoId: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("paused"),
    videoId: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("seeked"),
    videoId: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("completed"),
    videoId: z.string(),
  }),
  z.object({
    action: z.literal("progressed"),
    videoId: z.string(),
    percent: z.number(),
  }),
]);

export const trackVideoEvent = defineAction({
  input: VideoEventSchema,
  handler: async (event, ctx) => {
    try {
      console.log("Video event received:", event);

      const influxDBUrl = getSecret("INFLUX_HOST");
      const influxDBToken = getSecret("INFLUX_TOKEN");
      const influxDBOrg = getSecret("INFLUX_ORG");
      const influxDBBucket = getSecret("INFLUX_BUCKET");

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

      let point = Point.measurement("video")
        .setTag("action", event.action)
        .setTag("video", event.videoId)
        .setTag("viewer", ctx.locals.user?.sub ?? "anonymous");

      switch (event.action) {
        case "played":
        case "paused":
        case "seeked":
          point.setField("seconds", event.seconds, "integer");
          break;
        case "progressed":
          point.setField("percent", event.percent, "integer");
          break;
        case "completed":
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
