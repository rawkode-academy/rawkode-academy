import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import type { APIRoute } from "astro";

// Import getSecret conditionally to avoid client-side errors
let getSecret: (key: string) => string | undefined;
try {
	const envServer = await import("astro:env/server");
	getSecret = envServer.getSecret;
} catch (_error) {
	// Fallback for client-side or when module is not available
	getSecret = () => undefined;
}

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
		// Parse the request body
		const event = (await request.json()) as AnalyticsEvent;

		console.log("Web analytics event received:", event);

		const influxDBUrl = getSecret("INFLUX_HOST");
		const influxDBToken = getSecret("INFLUX_TOKEN");
		const influxDBOrg = getSecret("INFLUX_ORG");
		const influxDBBucket = getSecret("INFLUX_BUCKET");

		// Not configured, that's OK
		if (!influxDBUrl || !influxDBToken || !influxDBOrg || !influxDBBucket) {
			console.log(`InfluxDB not configured, skipping analytics`);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		const influxDB = new InfluxDBClient({
			host: influxDBUrl,
			token: influxDBToken,
			database: influxDBBucket,
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
				if (event.referrer) {
					point.setTag("referrer", event.referrer);
					point.setField("value", 0, "integer");
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
