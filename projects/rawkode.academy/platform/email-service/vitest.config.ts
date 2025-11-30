import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/__tests__/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"cloudflare:workers": path.join(
				__dirname,
				"rpc/__mocks__/cloudflare-workers.ts",
			),
			"cloudflare:email": path.join(
				__dirname,
				"rpc/__mocks__/cloudflare-email.ts",
			),
		},
	},
});
