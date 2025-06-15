import {
	INFLUXDB_BUCKET,
	INFLUXDB_HOST,
	INFLUXDB_ORG,
	getSecret,
} from "astro:env/server";
import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import type { APIRoute } from "astro";

interface AnalyticsEvent {
	action: string;
	path: string;
	browser: string;
	os: string;
	referrer?: string;
	time_on_page?: number;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_term?: string;
	utm_content?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const event = (await request.json()) as AnalyticsEvent;

		const influxDBToken = getSecret("INFLUXDB_TOKEN");

		// Not configured, that's OK
		if (!INFLUXDB_HOST || !INFLUXDB_ORG || !INFLUXDB_BUCKET || !influxDBToken) {
			console.log("InfluxDB not configured, skipping analytics");
			console.log(`Host is ${INFLUXDB_HOST}`);
			console.log(`Org is ${INFLUXDB_ORG}`);
			console.log(`Bucket is ${INFLUXDB_BUCKET}`);
			console.log(`Token is ${influxDBToken}`);

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		const influxDB = new InfluxDBClient({
			host: INFLUXDB_HOST,
			database: INFLUXDB_BUCKET,
			token: influxDBToken,
		});

		const point = Point.measurement("website")
			.setTag("action", event.action)
			.setTag("path", event.path)
			.setTag("viewer", locals.user?.sub ?? "anonymous")
			.setTag("browser", event.browser)
			.setTag("os", event.os);

		// Add CF-IPCountry header if available
		const country = request.headers.get("CF-IPCountry");
		if (country) {
			point.setTag("country", country);
		}

		// Add UTM parameters if they exist
		if (event.utm_source) point.setTag("utm_source", event.utm_source);
		if (event.utm_medium) point.setTag("utm_medium", event.utm_medium);
		if (event.utm_campaign) point.setTag("utm_campaign", event.utm_campaign);
		if (event.utm_term) point.setTag("utm_term", event.utm_term);
		if (event.utm_content) point.setTag("utm_content", event.utm_content);

		switch (event.action) {
			case "page.view":
				point.setField("value", 0, "integer");
				if (event.referrer) {
					point.setTag("referrer", event.referrer);
				}
				break;
			case "page.exit":
				point.setField("time_on_page", event.time_on_page, "integer");
				break;
		}

		console.log("Writing point to InfluxDB:", point);

		await influxDB.write(point);
		await influxDB.close();

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to process analytics event:", error);

		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
