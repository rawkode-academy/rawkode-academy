#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeployment } from "./setup.mjs";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const config = JSON.parse(await readFile(resolve(project, "wrangler.deploy.jsonc"), "utf8"));
  validateDeployment(config);
  if (process.argv.slice(2).some(arg => arg !== "--dry-run")) throw new Error("Supported argument: --dry-run");
  const child = spawn(process.execPath, [resolve(project, "node_modules/wrangler/bin/wrangler.js"), "deploy", "--config", "wrangler.deploy.jsonc", ...process.argv.slice(2)], { cwd: project, stdio: "inherit" });
  child.on("error", () => { console.error("Unable to start Wrangler"); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error.code === "ENOENT" ? "Run npm run setup -- --apply with your account, origin and owner-sub before deploying." : error.message);
  process.exitCode = 1;
}
