import {
	composeServices,
	compositionHasErrors,
} from "@theguild/federation-composition";
import { parse } from "graphql";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, "../schemas");
const outputPath = join(__dirname, "../supergraph.graphql");

// All subgraph service names - these must match the schema file names
const SUBGRAPHS = [
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

async function composeSupergraph() {
	console.log("Starting supergraph composition...\n");

	// Check what schema files exist
	let schemaFiles: string[];
	try {
		schemaFiles = readdirSync(schemasDir).filter((f) =>
			f.endsWith(".graphql"),
		);
	} catch {
		console.error(`Error: schemas directory not found at ${schemasDir}`);
		console.error("Run the collect-schemas step first to gather subgraph SDLs.");
		process.exit(1);
	}

	if (schemaFiles.length === 0) {
		console.error("No schema files found in schemas directory.");
		console.error("Run the collect-schemas step first to gather subgraph SDLs.");
		process.exit(1);
	}

	console.log(`Found ${schemaFiles.length} subgraph schemas:`);
	for (const file of schemaFiles) {
		console.log(`  - ${file}`);
	}
	console.log();

	const services: Array<{
		name: string;
		typeDefs: ReturnType<typeof parse>;
		url: string;
	}> = [];

	// Load each subgraph schema
	for (const file of schemaFiles) {
		const name = file.replace(".graphql", "");
		const schemaPath = join(schemasDir, file);

		try {
			const schema = readFileSync(schemaPath, "utf-8");
			services.push({
				name,
				typeDefs: parse(schema),
				// URL is a placeholder - we use service bindings, not HTTP
				url: `https://internal/${name}`,
			});
			console.log(`  Loaded schema for: ${name}`);
		} catch (error) {
			console.error(`Error loading schema for ${name}:`, error);
			process.exit(1);
		}
	}

	console.log(`\nComposing ${services.length} subgraphs...\n`);

	// Compose supergraph
	const result = composeServices(services);

	// Check for composition errors
	if (compositionHasErrors(result)) {
		console.error("Composition FAILED with errors:\n");
		for (const error of result.errors) {
			console.error(`  - ${error.message}`);
			if (error.extensions?.code) {
				console.error(`    Code: ${error.extensions.code}`);
			}
		}
		process.exit(1);
	}

	// Write supergraph SDL
	if (!result.supergraphSdl) {
		console.error("Composition produced no supergraph SDL");
		process.exit(1);
	}

	writeFileSync(outputPath, result.supergraphSdl);

	console.log("Supergraph successfully composed!");
	console.log(`  Output: ${outputPath}`);
	console.log(`  Subgraphs: ${services.length}`);
	console.log(
		`  Size: ${(result.supergraphSdl.length / 1024).toFixed(2)} KB`,
	);
}

composeSupergraph().catch((error) => {
	console.error("Composition failed:", error);
	process.exit(1);
});
