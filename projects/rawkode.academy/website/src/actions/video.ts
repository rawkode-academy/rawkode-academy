import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  getSecret,
  INFLUXDB_BUCKET,
  INFLUXDB_HOST,
  INFLUXDB_ORG,
} from "astro:env/server";

const VideoEventSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("played"),
    video: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("paused"),
    video: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("seeked"),
    video: z.string(),
    seconds: z.number(),
  }),
  z.object({
    action: z.literal("completed"),
    video: z.string(),
  }),
  z.object({
    action: z.literal("progressed"),
    video: z.string(),
    percent: z.number(),
  }),
]);

export const trackVideoEvent = defineAction({
  input: VideoEventSchema,
  handler: async (event, ctx) => {
    try {
      console.log("Video event received:", event);

      const influxDBToken = getSecret("INFLUXDB_TOKEN");

      // Not configured, that's OK
      if (
        !INFLUXDB_HOST ||
        !INFLUXDB_ORG ||
        !INFLUXDB_BUCKET ||
        !influxDBToken
      ) {
        console.log(`InfluxDB not configured, skipping event`);
        return { success: true };
      }

      const influxDB = new InfluxDBClient({
        host: INFLUXDB_HOST,
        database: INFLUXDB_BUCKET,
        token: influxDBToken,
      });

      const point = Point.measurement("video")
        .setTag("action", event.action)
        .setTag("video", event.video)
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
