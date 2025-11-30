import { execSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, "../../platform");
const schemasDir = join(__dirname, "../schemas");

// Services with GraphQL read models
const SERVICES = [
	"videos",
	"episodes",
	"people",
	"shows",
	"emoji-reactions",
	"casting-credits",
	"chapters",
	"people-biographies",
	"people-links",
	"show-hosts",
	"transcription-terms",
	"video-guests",
	"video-likes",
	"video-technologies",
	"email-preferences",
];

async function collectSchemas() {
	console.log("Collecting subgraph schemas...\n");

	// Ensure schemas directory exists
	if (!existsSync(schemasDir)) {
		mkdirSync(schemasDir, { recursive: true });
	}

	let successCount = 0;
	let failCount = 0;

	for (const service of SERVICES) {
		const serviceDir = join(platformDir, service);
		const readModelDir = join(serviceDir, "read-model");
		const schemaPath = join(readModelDir, "schema.gql");
		const publishPath = join(readModelDir, "publish.ts");

		console.log(`Processing ${service}...`);

		if (!existsSync(readModelDir)) {
			console.log(`  Skipped: no read-model directory`);
			failCount++;
			continue;
		}

		// Check if publish.ts exists
		if (!existsSync(publishPath)) {
			console.log(`  Skipped: no publish.ts script`);
			failCount++;
			continue;
		}

		try {
			// Run publish.ts to generate schema.gql
			console.log(`  Running publish.ts...`);
			execSync("bun run read-model/publish.ts", {
				cwd: serviceDir,
				stdio: "pipe",
			});

			// Check if schema.gql was generated
			if (!existsSync(schemaPath)) {
				console.log(`  Failed: schema.gql not generated`);
				failCount++;
				continue;
			}

			// Copy to schemas directory
			const destPath = join(schemasDir, `${service}.graphql`);
			copyFileSync(schemaPath, destPath);
			console.log(`  Success: copied to schemas/${service}.graphql`);
			successCount++;
		} catch (error) {
			console.log(
				`  Failed: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			failCount++;
		}
	}

	console.log(`\nSchema collection complete:`);
	console.log(`  Success: ${successCount}`);
	console.log(`  Failed: ${failCount}`);

	if (successCount === 0) {
		console.error("\nNo schemas were collected. Ensure services have publish.ts scripts.");
		process.exit(1);
	}
}

collectSchemas().catch((error) => {
	console.error("Schema collection failed:", error);
	process.exit(1);
});
