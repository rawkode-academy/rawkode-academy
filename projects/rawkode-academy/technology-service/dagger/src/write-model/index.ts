import type { Container, Directory, Secret, Service } from "@dagger.io/dagger";
import { argument, dag, func, object } from "@dagger.io/dagger";
import { Cloudflare } from "cloudflare";

@object()
export class WriteModel {
		@func()
		runRestateHandler(
			@argument({ defaultPath: "." }) directory: Directory,
		): Service {
			return dag
				.container()
				.from("node:20")
				.withMountedDirectory("/code", directory)
				.withWorkdir("/code")
				.withExec(["npm", "install"])
				.withExec(["npm", "install", "--global", "wrangler"])
				.withWorkdir("/code/write-model")
				.withExec([
					"npx",
					"wrangler",
					"dev",
					"--live-reload=false",
					"--ip=0.0.0.0",
					"--port=9001",
				])
				.withExposedPort(9001)
				.asService();
		}

		@func()
		async runTests(
			@argument({ defaultPath: "." }) directory: Directory,
		): Promise<Container> {
			const sqld = dag.sqld().service({
				port: 8001,
			});

			const restateServer = dag.restate().service();

			const restateHandler = this.runRestateHandler(directory);

			return (
				dag
					.container()
					.from("oven/bun")
					.withEnvVariable("RESTATE_ADMIN_URL", "http://restate:9070")
					.withServiceBinding("restate", restateServer)
					.withServiceBinding("restate-handler", restateHandler)
					// .withExec(["curl", "-v", "http://restate:8080"])
					// .withExec(["curl", "-v", "http://restate-handler:9001"])
					// // .withExec(["curl", "-v", "http://restate:9070"])
					.withExec([
						"bun",
						"x",
						"@restatedev/restate",
						"deployment",
						"register",
						"--yes",
						"--use-http1.1",
						"http://restate-handler:9001",
					])
					.sync()
			);

			// return await dag
			// 	.container()
			// 	.from("oven/bun")
			// 	.withMountedDirectory("/code", directory)
			// 	.withWorkdir("/code/data-model")
			// 	.withServiceBinding("sqld", sqld)
			// 	.withEnvVariable("TURSO_URL", `http://sqld:8001`)
			// 	.withExec(["bun", "migrate.ts"])
			// 	.sync();

			// return dag
			// 	.container()
			// 	.from("ghcr.io/stepci/stepci")
			// 	.withMountedDirectory("/tests", directory.directory("tests"))
			// 	.withWorkdir("/tests")
			// 	.withExec(["/stepci"]);
		}

		@func("writeModel.deployProduction")
		async deployProduction(
			@argument({ defaultPath: "." }) directory: Directory,
			onePasswordToken: Secret,
		): Promise<Container> {
			const globalConfig = dag.rawkodeAcademy().config();
			const cloudflareAccountID = await globalConfig.cloudflareAccountId();

			const cloudflareAccountToken = await dag
				.onePassword()
				.getSecretByReference(
					onePasswordToken,
					"op://sa.rawkode.academy/cloudflare/api-token",
				);

			await dag
				.nodeJs()
				.withBun(directory)
				.withExec(["bun", "install"])
				.withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountID)
				.withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareAccountToken)
				.withWorkdir("write-model")
				.withExec([
					// https://github.com/oven-sh/bun/issues/8867
					"sed",
					"-i",
					"/performance.markResourceTiming/d",
					"/code/node_modules/wrangler/wrangler-dist/cli.js",
				])
				.withExec(["bun", "run", "wrangler", "deploy", "--env", "production"])
				.sync();

			// TODO: We can refactor this to its own Dagger module and encapsulate the logic
			const workerName = "technology-service-write-model";

			const tursoToken = await dag
				.onePassword()
				.getSecretByReference(
					onePasswordToken,
					"op://sa.rawkode.academy/turso/platform-group/api-token",
				);

			const tursoTokenResponse = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountID}/workers/scripts/${workerName}-production/secrets`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${await cloudflareAccountToken.plaintext()}`,
					},
					body: JSON.stringify({
						name: "TURSO_TOKEN",
						type: "secret_text",
						text: await tursoToken.plaintext(),
					}),
				},
			);

			if (!tursoTokenResponse.ok) {
				throw new Error(
					`Error updating TURSO_TOKEN: ${tursoTokenResponse.statusText}`,
				);
			}

			const tursoUrlResponse = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountID}/workers/scripts/${workerName}-production/secrets`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${await cloudflareAccountToken.plaintext()}`,
					},
					body: JSON.stringify({
						name: "TURSO_URL",
						type: "secret_text",
						text: "libsql://technologies-rawkodeacademy.turso.io",
					}),
				},
			);

			if (!tursoUrlResponse.ok) {
				throw new Error(
					`Error updating TURSO_URL: ${tursoUrlResponse.statusText} - ${tursoUrlResponse.ok} - ${tursoUrlResponse.status}`,
				);
			}

			const restateIdentitiyKey = await dag
				.onePassword()
				.getSecretByReference(
					onePasswordToken,
					"op://sa.rawkode.academy/restate/identity-key",
				);

			const restateIdentityKeyResponse = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountID}/workers/scripts/${workerName}-production/secrets`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${await cloudflareAccountToken.plaintext()}`,
					},
					body: JSON.stringify({
						name: "RESTATE_IDENTITY_KEY",
						type: "secret_text",
						text: await restateIdentitiyKey.plaintext(),
					}),
				},
			);

			if (!restateIdentityKeyResponse.ok) {
				throw new Error(
					`Error updating RESTATE_IDENTITY_KEY: ${restateIdentityKeyResponse.statusText}`,
				);
			}

			const restateApiToken = await dag
				.onePassword()
				.getSecretByReference(
					onePasswordToken,
					"op://sa.rawkode.academy/restate/api-token",
				);

			return await dag
				.nodeJs()
				.withBun(directory)
				.withExec(["bun", "install"])
				.withEnvVariable("RESTATE_HOST_SCHEME", "https")
				.withEnvVariable(
					"RESTATE_HOST",
					"201j3n9npdrybn7f2z8tmnj8rds.env.us.restate.cloud",
				)
				.withSecretVariable("RESTATE_AUTH_TOKEN", restateApiToken)
				.withWorkdir("write-model")
				.withExec([
					"bun",
					"x",
					"@restatedev/restate",
					"deployment",
					"register",
					"--force",
					"--yes",
					"--environment=production",
					`https://${workerName}-production.rawkode-academy.workers.dev/`,
				]);

			// This isn't the correct way to update a secret
			// and secrets doesn't seem exposed on cloudflare.workers
			// Should open an issue
			//
			// const cloudflare = new Cloudflare({
			// 	apiToken: await cloudflareAccountToken.plaintext(),
			// });
			// await cloudflare.workersForPlatforms.dispatch.namespaces.scripts.secrets.update(
			// 		"production",
			// 		"technology-service-write-model",
			// 		{
			// 			account_id: cloudflareAccountID,
			// 			name: "TURSO_TOKEN",
			// 			type: "secret_text",
			// 			text: await tursoToken.plaintext(),
			// 		},
			// 	);
		}
	}
