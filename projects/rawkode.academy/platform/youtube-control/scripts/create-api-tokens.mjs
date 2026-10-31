#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../.poc-api-tokens.secrets.json");
try {
  await writeFile(file, JSON.stringify({ READ_API_TOKEN: randomBytes(48).toString("base64url"), WRITE_API_TOKEN: randomBytes(48).toString("base64url") }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log("Created .poc-api-tokens.secrets.json with mode 0600. No token values were printed. Upload with wrangler secret bulk and keep the file private.");
} catch (error) {
  console.error(error.code === "EEXIST" ? "Token file already exists; refusing to rotate credentials implicitly." : "Unable to create the private token file.");
  process.exitCode = 1;
}
