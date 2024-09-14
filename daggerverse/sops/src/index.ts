import type { Container, Directory, Secret } from "@dagger.io/dagger";
import { dag, object, func } from "@dagger.io/dagger";

@object()
class Sops {
	/**
	 * SOPs
	 */
	@func()
	async getSecrets(
		privateKey: Secret,
		directory: Directory,
	): Promise<Secret[]> {
		const output = await dag
			.container()
			.from("ghcr.io/getsops/sops:v3.9.0")
			.withExec(["apt", "update"])
			.withExec(["apt", "install", "--yes", "age"])
			.withMountedFile("/secrets", directory.file("sops.yaml"))
			.withMountedSecret("/private-key", privateKey)
			.withEnvVariable("SOPS_AGE_KEY_FILE", "/private-key")
			.withExec([
				"sops",
				"exec-file",
				"--output-type=json",
				"/secrets",
				"cat {}",
			]);

		return convertJsonToSecrets(JSON.parse(await output.stdout()));
	}
}

function convertJsonToSecrets(obj: Record<string, any>, prefix = ""): Secret[] {
	const secrets: Secret[] = [];

	for (const key in obj) {
		const value = obj[key];
		const newKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "string") {
			secrets.push(dag.setSecret(newKey, value));
		} else if (typeof value === "object" && !Array.isArray(value)) {
			secrets.push(...convertJsonToSecrets(value, newKey));
		} else {
			throw new Error(`Unsupported value type: ${typeof value}`);
		}
	}
	return secrets;
}
