import Client from "@dagger.io/dagger";
import { getSourceDir } from "../utils/index.mjs";
import { Container, Directory } from "@dagger.io/dagger/dist/api/client.gen";
import { TaskInnerAPI } from "tasuku";

export interface Config {
	nodeVersion?: string;
	npmCacheName?: string;
	environmentVariables?: Record<string, string>;
}

interface ConcreteConfig extends Config {
	programDirectory: Directory;
}

const setup = (client: Client, config: ConcreteConfig): Container => {
	const entrypointDir = client
		.host()
		.directory(`${getSourceDir(import.meta.url)}/scripts`);

	const cacheDir = client.cacheVolume(config.npmCacheName || "pnpm");

	let cdktf = client
		.container()
		.from(`node:${config.nodeVersion || "18-slim"}`)
		.withMountedCache("/work/.pnpm-store", cacheDir)
		.withMountedDirectory("/entrypoint", entrypointDir)
		.withMountedDirectory("/work", config.programDirectory)
		.withWorkdir("/work");

	for (const key in config.environmentVariables) {
		cdktf = cdktf.withEnvVariable(key, config.environmentVariables[key]);
	}

	return cdktf;
};

export const deploy = async (
	client: Client,
	tasuku: TaskInnerAPI,
	config: ConcreteConfig,
): Promise<string> => {
	const result = (
		await tasuku.task(
			"Running cdktf deploy",
			async ({ setError, setOutput }) => {
				const result = setup(client, config).withExec([
					"/entrypoint/deploy.sh",
				]);

				if ((await result.exitCode()) !== 0) {
					setError("cdktf deploy failed");
					setOutput(await result.stderr());
					throw new Error("cdktf deploy failed");
				}

				return result;
			},
		)
	).result;

	return await result.stdout();
};

export const destroy = async (
	client: Client,
	tasuku: TaskInnerAPI,
	config: ConcreteConfig,
): Promise<string> => {
	const result = (
		await tasuku.task(
			"Running cdktf destroy",
			async ({ setError, setOutput }) => {
				const result = setup(client, config).withExec([
					"/entrypoint/destroy.sh",
				]);

				if ((await result.exitCode()) !== 0) {
					setError("cdktf destroy failed");
					setOutput(await result.stderr());
					throw new Error("cdktf destroy failed");
				}

				return result;
			},
		)
	).result;

	return await result.stdout();
};

export const plan = async (
	client: Client,
	tasuku: TaskInnerAPI,
	config: ConcreteConfig,
): Promise<string> => {
	const result = (
		await tasuku.task("Running cdktf plan", async ({ setError, setOutput }) => {
			const result = setup(client, config).withExec(["/entrypoint/plan.sh"]);

			if ((await result.exitCode()) !== 0) {
				setError("cdktf plan failed");
				setOutput(await result.stderr());
				throw new Error("cdktf plan failed");
			}

			return result;
		})
	).result;

	return await result.stdout();
};
