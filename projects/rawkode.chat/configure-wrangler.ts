// Point a checkout of the Waddle web client (waddle-social/waddle, chat/) at
// the Rawkode Chat tenant. Waddle's own wrangler.jsonc stays the source of
// compatibility settings and bindings; only the deployment identity changes.
//
// Usage: bun configure-wrangler.ts <waddle-checkout>/chat/wrangler.jsonc

const path = process.argv[2];
if (!path) {
	console.error("usage: bun configure-wrangler.ts <path to chat/wrangler.jsonc>");
	process.exit(1);
}

const config = Bun.JSONC.parse(await Bun.file(path).text()) as Record<string, unknown>;

config.name = "rawkode-chat";
config.workers_dev = false;
config.preview_urls = false;
config.routes = [{ pattern: "rawkode.chat", custom_domain: true }];
config.vars = {
	...(config.vars as Record<string, string> | undefined),
	// Hosted Waddle server for the rawkode.chat tenant (JIDs user@rawkode.chat).
	SERVER_BASE_URL: "https://waddle.rawkode.chat",
};
config.observability = {
	traces: { enabled: true, destinations: ["grafana-traces"] },
	logs: { enabled: true, destinations: ["grafana-logs"] },
};

await Bun.write(path, `${JSON.stringify(config, null, "\t")}\n`);
console.log(`configured ${path} for rawkode.chat`);
