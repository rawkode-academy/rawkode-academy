import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { up, preview } from "@rawkode.academy/dagger/pulumi/dagger.mjs";
import { resolveSecret } from "@rawkode.academy/dagger/secrets/index.mjs";
import { getSourceDir } from "@rawkode.academy/dagger/utils/index.mjs";
import { z } from "zod";

const ZoneMap = z.record(z.string());
type ZoneMap = z.infer<typeof ZoneMap>;

const PulumiOutput = z.object({
	zoneNameMap: ZoneMap,
});
type PulumiOutput = z.infer<typeof PulumiOutput>;

export const execute = async (client: Client): Promise<PulumiOutput> => {
	const sourcePath = getSourceDir(`${import.meta.url}/..`);

	const googleCredentials = await resolveSecret({
		vault: "sa.core.infrastructure.dns",
		item: "pulumi-google-credentials",
		key: "password",
	});

	const gandiKey = await resolveSecret({
		vault: "sa.core.infrastructure.dns",
		item: "gandi",
		key: "password",
	});

	const sourceDirectory = client.host().directory(sourcePath, {
		exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
	});

	const returnedJson = await preview(client, {
		version: "3.49.0",
		runtime: "nodejs",
		stackCreate: false,
		stack: "production",
		programDirectory: sourceDirectory,
		environmentVariables: {
			GOOGLE_CREDENTIALS: googleCredentials,
			GANDI_KEY: gandiKey,
		},
	});

	const pulumiOutput = PulumiOutput.safeParse(returnedJson);
	if (!pulumiOutput.success) {
		throw new Error("pulumi up for DNS did not return a valid zone map");
	}

	return pulumiOutput.data;
};

const command: DaggerCommand = {
	name: "deploy",
	description: "Deploy the DNS infrastructure",
	execute,
};
export default command;
