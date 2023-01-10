import { $ } from "zx";

interface SecretRequest {
	vault: string;
	item: string;
	key: string;
	as: string;
}

type SecretsRequest = SecretRequest[];
type SecretsResponse = Record<string, string>;

export const resolveSecrets = async (
	requests: SecretsRequest,
): Promise<SecretsResponse> => {
	$.verbose = false;

	return requests.reduce(async (secrets, { vault, item, key, as }) => {
		const response = await $`op read --no-newline op://${vault}/${item}/${key}`;

		if (response.exitCode !== 0) {
			console.error(
				`Failed to resolve ${vault}/${item}/${key}: ${response.stderr}`,
			);
			return secrets;
		}

		return {
			[as]: response.stdout,
			...secrets,
		};
	}, {});
};
