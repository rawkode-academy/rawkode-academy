import { InfisicalClient } from "@infisical/sdk";

interface Secrets {
	tursoUrl: string;
	tursoToken: string;
}

export const getSecrets = async (): Promise<Secrets> => {
	if (process.env.INFISICAL_MACHINE_ID?.includes("op://")) {
		return {
			tursoUrl: "http://127.0.0.1:4021",
			tursoToken: "",
		};
	}

	const infisical = new InfisicalClient({
		clientId: process.env.INFISICAL_MACHINE_ID as string,
		clientSecret: process.env.INFISICAL_MACHINE_SECRET as string,
	});

	const tursoUrl = await infisical.getSecret({
		projectId: process.env.INFISICAL_PROJECT_ID as string,
		environment: process.env.INFISICAL_ENVIRONMENT as string,
		path: process.env.INFISICAL_PATH as string,
		secretName: "TURSO_URL",
	});

	const tursoToken = await infisical.getSecret({
		projectId: process.env.INFISICAL_PROJECT_ID as string,
		environment: process.env.INFISICAL_ENVIRONMENT as string,
		path: "/projects/rawkode-academy",
		secretName: "TURSO_TOKEN_RW",
	});

	return {
		tursoUrl: tursoUrl.secretValue,
		tursoToken: tursoToken.secretValue,
	};
};
