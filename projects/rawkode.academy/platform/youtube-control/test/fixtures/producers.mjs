import { WorkerEntrypoint } from "cloudflare:workers";

// These bindings run only in Miniflare. Their fetches are intercepted by the
// test's outboundService; there is deliberately no real K2 or Pipeline binding.
export class K2Producer extends WorkerEntrypoint {
  async send(records) {
    const body = records.map(record => ({
      content: btoa(String.fromCharCode(...new Uint8Array(record.content))),
      headers: record.headers,
    }));
    const response = await fetch("https://mock.internal/k2-produce", { method: "POST", body: JSON.stringify(body) });
    return response.json();
  }
}

export class PipelineProducer extends WorkerEntrypoint {
  async send(records) {
    const response = await fetch("https://mock.internal/pipeline-send", { method: "POST", body: JSON.stringify(records) });
    if (!response.ok) throw new Error("Mock Pipeline rejected the batch");
  }
}

export default { fetch() { return new Response("Not found", { status: 404 }); } };
