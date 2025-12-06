import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicKeyEncoding: {
		type: "spki",
		format: "pem",
	},
	privateKeyEncoding: {
		type: "pkcs8",
		format: "pem",
	},
});

console.log("Generated RSA-2048 Key Pair\n");
console.log("=".repeat(60));
console.log("PRIVATE KEY (PKCS8 PEM):");
console.log("=".repeat(60));
console.log(privateKey);
console.log("\n");
console.log("=".repeat(60));
console.log("PUBLIC KEY (SPKI PEM):");
console.log("=".repeat(60));
console.log(publicKey);

const privateKeyEscaped = privateKey.replace(/\n/g, "\\n");
const publicKeyEscaped = publicKey.replace(/\n/g, "\\n");

const envContent = `# Generated RSA Keys for Badge Service
# Generated at: ${new Date().toISOString()}

BADGE_ISSUER_RSA_PRIVATE_KEY="${privateKeyEscaped}"
BADGE_ISSUER_RSA_PUBLIC_KEY="${publicKeyEscaped}"
BADGE_ISSUER_URL="http://localhost:8787"
`;

const envPath = join(import.meta.dir, "..", "http", ".dev.vars");
const envExists = existsSync(envPath);

if (envExists) {
	console.log("\n");
	console.log("=".repeat(60));
	console.log("WARNING: .dev.vars already exists!");
	console.log("Keys NOT written to avoid overwriting existing configuration.");
	console.log("To use these keys, manually update: http/.dev.vars");
	console.log("=".repeat(60));
} else {
	writeFileSync(envPath, envContent);
	console.log("\n");
	console.log("=".repeat(60));
	console.log("Keys written to: http/.dev.vars");
	console.log("=".repeat(60));
}

console.log("\n");
console.log("=".repeat(60));
console.log("USAGE INSTRUCTIONS:");
console.log("=".repeat(60));
console.log("1. Keys have been generated in PEM format");
console.log("2. Private key format: PKCS8 (-----BEGIN PRIVATE KEY-----)");
console.log("3. Public key format: SPKI (-----BEGIN PUBLIC KEY-----)");
console.log("4. For .dev.vars, newlines are escaped as \\n");
console.log("5. Start the dev server: cd http && bun run wrangler dev --local");
console.log("=".repeat(60));
