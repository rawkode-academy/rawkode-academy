import { execSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, "../../platform");
const websiteDir = join(__dirname, "../../website");
const schemasDir = join(__dirname, "../schemas");

// User interaction services (still separate workers with D1)
const SERVICES = [
	"emoji-reactions",
	"video-likes",
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

	// Collect website subgraph schema
	console.log("\nCollecting website subgraph schema...");
	const websitePublishPath = join(websiteDir, "src/subgraph/publish.ts");

	if (existsSync(websitePublishPath)) {
		try {
			console.log("  Running website publish.ts...");
			execSync("bun run src/subgraph/publish.ts", {
				cwd: websiteDir,
				stdio: "pipe",
			});

			const websiteSchemaPath = join(websiteDir, "src/subgraph/schema.gql");
			if (existsSync(websiteSchemaPath)) {
				const destPath = join(schemasDir, "website.graphql");
				copyFileSync(websiteSchemaPath, destPath);
				console.log("  Success: copied to schemas/website.graphql");
				successCount++;
			} else {
				console.log("  Failed: schema.gql not generated");
				failCount++;
			}
		} catch (error) {
			console.log(
				`  Failed: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			failCount++;
		}
	} else {
		console.log("  Skipped: no publish.ts script found");
		failCount++;
	}

	console.log(`\nSchema collection complete:`);
	console.log(`  Success: ${successCount}`);
	console.log(`  Failed: ${failCount}`);

	if (successCount === 0) {
		console.error("\nNo schemas were collected.");
		process.exit(1);
	}
}

collectSchemas().catch((error) => {
	console.error("Schema collection failed:", error);
	process.exit(1);
});
