// Uploads seeds/assets.json to the content bucket, skipping keys that already
// exist. Run with the video importer's production environment, which has the
// bucket's S3 credentials:
//
//   cd projects/rawkode.academy/tasks/video-importer
//   cuenv -e production exec -- bun ../content-cutover/scripts/upload-assets.ts \
//   	--content <dir>/content [--dry-run]
import { join } from "node:path";
import { parseArgs } from "node:util";
import { S3Client } from "bun";
import type { Asset } from "./build-seeds";

const { values: args } = parseArgs({
	options: {
		content: { type: "string" },
		seeds: { type: "string", default: join(import.meta.dir, "../seeds") },
		"dry-run": { type: "boolean", default: false },
	},
});
if (!args.content) throw new Error("usage: --content <dir> [--seeds <dir>] [--dry-run]");
const seeds = args.seeds as string;

const env = (name: string) => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
};
const bucket = new S3Client({
	endpoint: env("CONTENT_ENDPOINT"),
	bucket: env("CONTENT_BUCKET"),
	accessKeyId: env("CONTENT_ACCESS_KEY"),
	secretAccessKey: env("CONTENT_SECRET_KEY"),
});

const assets: Asset[] = await Bun.file(join(seeds, "assets.json")).json();
const queue = [...assets];
const uploaded: string[] = [];
const skipped: string[] = [];

async function worker() {
	for (let asset = queue.shift(); asset; asset = queue.shift()) {
		const source = asset.content ? join(args.content as string, asset.content) : join(seeds, asset.rendered as string);
		const file = Bun.file(source);
		if (!(await file.exists())) throw new Error(`${asset.key}: missing ${source}`);
		if (await bucket.exists(asset.key)) {
			skipped.push(asset.key);
			continue;
		}
		if (!args["dry-run"]) await bucket.write(asset.key, file, { type: asset.contentType });
		uploaded.push(asset.key);
	}
}
await Promise.all(Array.from({ length: 8 }, worker));

console.log(`${args["dry-run"] ? "would upload" : "uploaded"} ${uploaded.length}, skipped ${skipped.length} existing`);
