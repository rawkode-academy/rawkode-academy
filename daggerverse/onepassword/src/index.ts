import { createClient } from "@1password/sdk";
import { dag, func, object, type Secret } from "@dagger.io/dagger";

@object()
class OnePassword {
	@func()
	async getSecretByReference(
		opToken: Secret,
		secretReference: string,
	): Promise<Secret> {
		const client = await createClient({
			auth: await opToken.plaintext(),
			integrationName: "Dagger",
			integrationVersion: "v1.0.0",
		});

		return dag.setSecret(
			secretReference,
			await client.secrets.resolve(secretReference),
		);
	}
}

