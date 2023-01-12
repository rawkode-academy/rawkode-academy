import { $ } from "zx";

interface SecretRequest {
	vault: string;
	item: string;
	key: string;
}

export const resolveSecret = async ({
	vault,
	item,
	key,
}: SecretRequest): Promise<string> => {
	$.verbose = false;

	const response = await $`op read --no-newline "op://${vault}/${item}/${key}"`;

	if (response.exitCode !== 0) {
		throw new Error(
			`Failed to resolve "${vault}/${item}/${key}": ${response.stderr}`,
		);
	}
	return response.stdout.trim();
};
