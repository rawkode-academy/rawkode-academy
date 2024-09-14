import type { Directory, Secret } from "@dagger.io/dagger";
import { dag, object, func } from "@dagger.io/dagger";

/**
 * SOPS: Simple And Flexible Tool For Managing Secrets
 */
@object()
class Sops {
	/**
	 * Get a list of secrets from an encrypted SOPs file
	 *
	 * @param privateKey 	The private key used for decrypting secrets
	 * @param directory 	The directory containing the encrypted SOPs file
	 * @param inputType 	The input format of your encrypted SOPs file
	 * @returns 					A list of secrets
	 */
	@func()
	async getSecrets(
		privateKey: Secret,
		directory: Directory,
		inputType: string = "yaml",
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
				`--input-type=${inputType}`,
				"--output-type=json",
				"/secrets",
				"cat {}",
			]);

		return convertJsonToSecrets(JSON.parse(await output.stdout()));
	}
}

const convertJsonToSecrets = (obj: Record<string, any>, prefix = ""): Secret[] => {
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
