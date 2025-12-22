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

// User interaction services (platform/ directory)
const PLATFORM_SERVICES = [
	"emoji-reactions",
	"email-preferences",
	"watch-history",
];

// Helper function to collect schema from a service directory
function collectServiceSchema(
	serviceDir: string,
	schemaName: string,
): boolean {
	const readModelDir = join(serviceDir, "read-model");
	const schemaPath = join(readModelDir, "schema.gql");
	const publishPath = join(readModelDir, "publish.ts");

	console.log(`Processing ${schemaName}...`);

	if (!existsSync(readModelDir)) {
		console.log(`  Skipped: no read-model directory`);
		return false;
	}

	if (!existsSync(publishPath)) {
		console.log(`  Skipped: no publish.ts script`);
		return false;
	}

	try {
		console.log(`  Running publish.ts...`);
		// Safe: hardcoded command with no user input
		execSync("bun run read-model/publish.ts", {
			cwd: serviceDir,
			stdio: "pipe",
		});

		if (!existsSync(schemaPath)) {
			console.log(`  Failed: schema.gql not generated`);
			return false;
		}

		const destPath = join(schemasDir, `${schemaName}.graphql`);
		copyFileSync(schemaPath, destPath);
		console.log(`  Success: copied to schemas/${schemaName}.graphql`);
		return true;
	} catch (error) {
		console.log(
			`  Failed: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		return false;
	}
}

async function collectSchemas() {
	console.log("Collecting subgraph schemas...\n");

	if (!existsSync(schemasDir)) {
		mkdirSync(schemasDir, { recursive: true });
	}

	let successCount = 0;
	let failCount = 0;

	// Collect platform service schemas
	console.log("=== Platform Services ===\n");
	for (const service of PLATFORM_SERVICES) {
		const serviceDir = join(platformDir, service);
		if (collectServiceSchema(serviceDir, service)) {
			successCount++;
		} else {
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
