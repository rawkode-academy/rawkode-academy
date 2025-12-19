import { CloudEvent } from "cloudevents";

type CaptureOptions = {
	event: string;
	properties?: Record<string, unknown>;
	distinctId: string;
};

function createCloudEvent(
	type: string,
	source: string,
	data: Record<string, unknown>,
): CloudEvent<Record<string, unknown>> {
	return new CloudEvent({
		specversion: "1.0",
		type,
		source,
		id: crypto.randomUUID(),
		time: new Date().toISOString(),
		datacontenttype: "application/json",
		data,
	});
}

export async function captureAuthEvent(
	opts: CaptureOptions,
	analytics?: Fetcher,
): Promise<void> {
	const { event, properties = {}, distinctId } = opts;

	const cloudEvent = createCloudEvent(event, "/rawkode-academy-identity", {
		...properties,
		distinct_id: distinctId,
	});

	if (analytics) {
		try {
			await analytics.fetch("https://analytics.internal/track", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					event: cloudEvent,
					attributes: ["distinct_id"],
				}),
			});
		} catch (err) {
			console.error("Analytics service binding call failed", err);
		}
	}
}
