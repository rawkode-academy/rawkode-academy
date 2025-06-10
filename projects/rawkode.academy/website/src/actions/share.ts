import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  getSecret,
  INFLUXDB_BUCKET,
  INFLUXDB_HOST,
  INFLUXDB_ORG,
} from "astro:env/server";

const ShareEventSchema = z.object({
  action: z.enum(["share"]),
  platform: z.enum(["clipboard", "bluesky", "linkedin", "reddit", "twitter"]),
  content_type: z.enum(["video", "article", "page"]),
  content_id: z.string(),
  success: z.boolean().default(true),
});

export const trackShareEvent = defineAction({
  input: ShareEventSchema,
  handler: async (event, ctx) => {
    try {
      console.log("Share event received:", event);

      const influxDBToken = getSecret("INFLUXDB_TOKEN");

      // Not configured, that's OK
      if (
        !INFLUXDB_HOST ||
        !INFLUXDB_ORG ||
        !INFLUXDB_BUCKET ||
        !influxDBToken
      ) {
        console.log("InfluxDB not configured, skipping event");
        return { success: true };
      }

      const influxDB = new InfluxDBClient({
        host: INFLUXDB_HOST,
        database: INFLUXDB_BUCKET,
        token: influxDBToken,
      });

      const point = Point.measurement("share")
        .setTag("action", event.action)
        .setTag("platform", event.platform)
        .setTag("content_type", event.content_type)
        .setTag("content_id", event.content_id)
        .setTag("viewer", ctx.locals.user?.sub ?? "anonymous")
        .setField("success", event.success);

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
          : "Failed to process share event",
      });
    }
  },
});
