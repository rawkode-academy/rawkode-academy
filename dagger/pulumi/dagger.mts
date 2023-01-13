import Client from "@dagger.io/dagger";
import { getSourceDir } from "../utils/index.mjs";
import { Container, Directory } from "@dagger.io/dagger/dist/api/client.gen";

export interface Config {
	version: string;
	runtime: "nodejs" | "go";
	stackCreate?: boolean;
	environmentVariables?: Record<string, string>;
	googleCloudGkeCluster?: boolean;
}

interface ConcreteConfig extends Config {
	stack: string;
	programDirectory: Directory;
	accessToken?: string;
	passphrase?: string;
}

const setup = (client: Client, config: ConcreteConfig): Container => {
	const entrypointDir = client
		.host()
		.directory(`${getSourceDir(import.meta.url)}/scripts`);

	const pulumiCache = client.cacheVolume("pulumi");
	const cacheDir = client.cacheVolume("pnpm");

	let pulumi = client
		.container()
		.from(`pulumi/pulumi-${config.runtime}:${config.version}`)
		.withMountedCache("/root/.pulumi", pulumiCache)
		.withMountedCache("/work/.pnpm-store", cacheDir)
		.withMountedDirectory("/entrypoint", entrypointDir)
		.withMountedDirectory("/work", config.programDirectory)
		.withWorkdir("/work")
		.withEnvVariable("PULUMI_RUNTIME", config.runtime)
		.withEnvVariable("PULUMI_STACK", config.stack)
		.withEnvVariable(
			"PULUMI_STACK_CREATE",
			config.stackCreate ? "true" : "false",
		);

	for (const key in config.environmentVariables) {
		pulumi = pulumi.withEnvVariable(key, config.environmentVariables[key]);
	}

	if (config.runtime === "nodejs") {
		pulumi = pulumi.withExec(["/entrypoint/nodejs.sh"]);
	}

	if (config.passphrase) {
		pulumi = pulumi
			.withEnvVariable("PULUMI_CONFIG_PASSPHRASE", config.passphrase)
			.withExec(["/entrypoint/login-local.sh"]);
	}

	if (config.accessToken) {
		pulumi = pulumi
			.withEnvVariable("PULUMI_ACCESS_TOKEN", config.accessToken)
			.withExec(["/entrypoint/login-saas.sh"]);
	}

	if (config.googleCloudGkeCluster) {
		pulumi = pulumi.withExec(["/entrypoint/setup-gke.sh"]);
	}

	return pulumi;
};

export const up = async (
	client: Client,
	config: ConcreteConfig,
): Promise<string> => {
	const result = setup(client, config).withExec(["/entrypoint/up.sh"]);

	if ((await result.exitCode()) !== 0) {
		const stderr = await result.stderr();
		throw new Error(`Pulumi up failed: ${stderr}`);
	}

	return await result.file("/output/json").contents();
};

export const destroy = async (
	client: Client,
	config: ConcreteConfig,
): Promise<string> => {
	const result = setup(client, config).withExec(["/entrypoint/destroy.sh"]);

	if ((await result.exitCode()) !== 0) {
		const stderr = await result.stderr();
		throw new Error(`Pulumi up failed: ${stderr}`);
	}

	return await result.stdout();
};

export const preview = async (
	client: Client,
	config: ConcreteConfig,
): Promise<string> => {
	let pulumi = setup(client, config);

	const result = pulumi.withExec(["/entrypoint/preview.sh"]);

	if ((await result.exitCode()) !== 0) {
		const stderr = await result.stderr();
		throw new Error(`Pulumi up failed: ${stderr}`);
	}

	return await result.stdout();
};
