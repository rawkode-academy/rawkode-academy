#!/usr/bin/env bun

const PROJECT_ID = "458678766461";
const POOL_ID = "github";
const WORKLOAD_IDENTITY_POOL_ID = `projects/${PROJECT_ID}/locations/global/workloadIdentityPools/${POOL_ID}`;

const secretName = prompt("Enter secret name:");

if (!secretName) {
	console.error("Secret name is required");
	process.exit(1);
}

const args = [
	"secrets",
	"add-iam-policy-binding",
	secretName,
	`--project=${PROJECT_ID}`,
	"--role=roles/secretmanager.secretAccessor",
	`--member=principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/rawkode-academy/rawkode-academy`,
];

console.log(`Granting secret access for: ${secretName}`);

const proc = Bun.spawn(["gcloud", ...args], {
	stdout: "inherit",
	stderr: "inherit",
});

const exitCode = await proc.exited;
process.exit(exitCode);
