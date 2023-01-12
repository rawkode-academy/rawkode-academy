import Client from "@dagger.io/dagger";
import { DaggerCommand } from "@rawkode.academy/dagger/index.mjs";
import { up } from "@rawkode.academy/dagger/pulumi/dagger.mjs";
import { resolveSecrets } from "@rawkode.academy/dagger/secrets/index.mjs";
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

	const secrets = await resolveSecrets([
		{
			vault: "sa.core.infrastructure",
			item: "gandi",
			key: "password",
			as: "GANDI_KEY",
		},
	]);

	const sourceDirectory = client.host().directory(sourcePath, {
		exclude: [".git", ".pnpm-store", "dagger", "dagger.ts", "node_modules"],
	});

	const returnedJson = await up(client, {
		version: "3.49.0",
		runtime: "nodejs",
		stackCreate: false,
		stack: "production",
		programDirectory: sourceDirectory,
		environmentVariables: secrets,
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
