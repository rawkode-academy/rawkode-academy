// Deploy the Waddle web client (waddle-social/waddle, chat/) as rawkode.chat.
//
// Waddle's CI publishes every production build of the client as an OCI
// artifact (chat/scripts/publish-dist.sh upstream). This pulls that build,
// gives it the rawkode.chat deployment identity and deploys it with the
// wrangler version it was built with. Nothing of Waddle is cloned or built.
//
// Usage: bun deploy.ts [wrangler deploy flags, e.g. --dry-run]
//
// WADDLE_CHAT_DIST selects the build: an OCI reference (default
// ghcr.io/waddle-social/waddle/chat-dist:main) or a local chat-dist.tar.gz.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const source = process.env.WADDLE_CHAT_DIST || "ghcr.io/waddle-social/waddle/chat-dist:main";

const work = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), "rawkode-chat-"));
try {
	const archive = source.endsWith(".tar.gz") ? source : join(work, "chat-dist.tar.gz");
	if (archive !== source) {
		await Bun.write(archive, await pull(source));
	}
	const app = join(work, "app");
	await $`mkdir -p ${app} && tar -xzf ${archive} -C ${app}`;

	const artifact = (await Bun.file(join(app, "artifact.json")).json()) as {
		revision: string;
		wrangler: string;
	};
	console.log(`waddle chat @ ${artifact.revision} (wrangler ${artifact.wrangler})`);

	// Waddle's generated wrangler config stays the source of compatibility
	// settings and bindings; only the deployment identity changes.
	const configPath = join(app, "dist/server/wrangler.json");
	const config = (await Bun.file(configPath).json()) as Record<string, unknown>;
	// Absolute paths on Waddle's CI runner; wrangler sets them from this file.
	delete config.configPath;
	delete config.userConfigPath;
	config.name = "rawkode-chat";
	config.topLevelName = "rawkode-chat";
	config.workers_dev = false;
	config.preview_urls = false;
	config.routes = [{ pattern: "rawkode.chat", custom_domain: true }];
	// Waddle's Faro collector is waddle.chat's own runtime config (FARO_*
	// vars), never part of the published build; drop any that ever arrive so
	// rawkode.chat ships with telemetry off.
	const inherited = Object.entries((config.vars as Record<string, string> | undefined) ?? {}).filter(
		([name]) => !name.startsWith("FARO_"),
	);
	config.vars = {
		...Object.fromEntries(inherited),
		// Hosted Waddle server for the rawkode.chat tenant (JIDs user@rawkode.chat).
		SERVER_BASE_URL: "https://waddle.rawkode.chat",
	};
	config.observability = {
		traces: { enabled: true, destinations: ["grafana-traces"] },
		logs: { enabled: true, destinations: ["grafana-logs"] },
	};
	await Bun.write(configPath, `${JSON.stringify(config, null, "\t")}\n`);

	const deploy = Bun.spawn(["bun", "x", `wrangler@${artifact.wrangler}`, "deploy", ...process.argv.slice(2)], {
		cwd: app,
		stdio: ["inherit", "inherit", "inherit"],
	});
	process.exitCode = await deploy.exited;
} finally {
	await rm(work, { recursive: true, force: true });
}

// Fetch the single layer of a public OCI artifact, verified against its digest.
async function pull(reference: string): Promise<Uint8Array> {
	const match = reference.match(/^([^/]+)\/(.+):([^:/]+)$/);
	if (!match) throw new Error(`not an OCI reference with a tag: ${reference}`);
	const [, registry, repository, tag] = match;
	const base = `https://${registry}/v2/${repository}`;

	let headers: Record<string, string> = {};
	const get = async (url: string, accept?: string) => {
		let response = await fetch(url, { headers: { ...headers, ...(accept && { accept }) } });
		const challenge = response.headers.get("www-authenticate");
		if (response.status === 401 && challenge?.startsWith("Bearer ")) {
			// Anonymous pull token, as for any public package.
			const params = Object.fromEntries(
				[...challenge.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
			);
			const token = new URL(params.realm);
			if (params.service) token.searchParams.set("service", params.service);
			if (params.scope) token.searchParams.set("scope", params.scope);
			const tokenResponse = await fetch(token);
			if (!tokenResponse.ok) throw new Error(`${token}: ${tokenResponse.status}`);
			headers = { authorization: `Bearer ${((await tokenResponse.json()) as { token: string }).token}` };
			response = await fetch(url, { headers: { ...headers, ...(accept && { accept }) } });
		}
		if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
		return response;
	};

	const manifestResponse = await get(`${base}/manifests/${tag}`, "application/vnd.oci.image.manifest.v1+json");
	const manifest = (await manifestResponse.json()) as { layers: { digest: string }[] };
	const [layer] = manifest.layers;
	if (manifest.layers.length !== 1 || !layer) {
		throw new Error(`${reference}: expected one layer, got ${manifest.layers.length}`);
	}
	console.log(`pulling ${reference} (${manifestResponse.headers.get("docker-content-digest")})`);
	const blob = new Uint8Array(await (await get(`${base}/blobs/${layer.digest}`)).arrayBuffer());
	const digest = `sha256:${new Bun.CryptoHasher("sha256").update(blob).digest("hex")}`;
	if (digest !== layer.digest) throw new Error(`${reference}: layer digest ${digest}, expected ${layer.digest}`);
	return blob;
}
