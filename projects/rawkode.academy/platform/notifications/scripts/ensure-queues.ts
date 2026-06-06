import { spawnSync } from "node:child_process";

const queueNames = (
	process.env.CLOUDFLARE_QUEUE_NAMES ??
	"rawkode-academy-notifications"
)
	.split(",")
	.map((queue) => queue.trim())
	.filter(Boolean);

const wranglerConfig = process.env.WRANGLER_CONFIG?.trim();

function wrangler(args: string[]) {
	const configArgs = wranglerConfig ? ["--config", wranglerConfig] : [];
	return spawnSync("bun", ["x", "wrangler", ...args, ...configArgs], {
		encoding: "utf8",
		stdio: "pipe",
	});
}

function ensureQueue(queueName: string): void {
	const info = wrangler(["queues", "info", queueName]);
	if (info.status === 0) {
		console.log(`Queue ${queueName} already exists.`);
		return;
	}

	const create = wrangler(["queues", "create", queueName]);
	const output = `${create.stdout}\n${create.stderr}`;
	if (create.status === 0 || /already exists/i.test(output)) {
		console.log(`Queue ${queueName} is ready.`);
		return;
	}

	throw new Error(output.trim() || `Failed to create queue ${queueName}.`);
}

for (const queueName of queueNames) {
	ensureQueue(queueName);
}
