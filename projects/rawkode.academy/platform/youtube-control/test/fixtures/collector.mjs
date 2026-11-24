import { WorkerEntrypoint } from "cloudflare:workers";

// Stands in for rawkode-tools-observability-collector in Miniflare. Its fetch
// is intercepted by the test's outboundService.
export class Collector extends WorkerEntrypoint {
  async trackEvent(event) {
    const response = await fetch("https://mock.internal/collector-track", { method: "POST", body: JSON.stringify(event) });
    return response.json();
  }
}

export default { fetch() { return new Response("Not found", { status: 404 }); } };
