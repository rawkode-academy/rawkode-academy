import type { Container, Directory, Secret } from "@dagger.io/dagger";
import { argument, dag, func, object } from "@dagger.io/dagger";
import { createClient } from "@tursodatabase/api";

@object()
export class DataModel {
	@func("dataModel.deployProduction")
	async deployProduction(
		@argument({ defaultPath: "." }) directory: Directory,
		onePasswordToken: Secret,
	): Promise<Container> {
		const tursoBaseUrl = "rawkodeacademy.turso.io";

		const tursoToken = await dag
			.onePassword()
			.getSecretByReference(
				onePasswordToken,
				"op://sa.rawkode.academy/turso/platform-group/api-token",
			);

		const tursoPlatformToken = await dag
			.onePassword()
			.getSecretByReference(
				onePasswordToken,
				"op://sa.rawkode.academy/turso/platform-api/api-token",
			);

		const turso = createClient({
			org: "rawkodeacademy",
			token: await tursoPlatformToken.plaintext(),
		});

		try {
			await turso.databases.get("technologies");
		} catch (error) {
			console.log(
				`Failed to get technologies database: ${error.status}:${error.message}`,
			);

			if (error.status !== 404) {
				throw error;
			}

			await turso.databases.create("technologies", {
				group: "platform",
			});
		}

		return await dag
			.nodeJs()
			.withBun(directory)
			.withExec(["bun", "install"])
			.withEnvVariable("TURSO_URL", `libsql://technologies-${tursoBaseUrl}`)
			.withSecretVariable("TURSO_TOKEN", tursoToken)
			.withWorkdir("data-model")
			.withExec(["bun", "migrate.ts"]);
	}
}
