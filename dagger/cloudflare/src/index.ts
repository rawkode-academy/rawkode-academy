import {
	dag,
	type Container,
	type Directory,
	type File,
	func,
	object,
	type Secret,
} from "@dagger.io/dagger";

// Type definitions for better type safety
type WranglerCommand = 
	| { type: "deploy"; args?: string[] }
	| { type: "deploy-assets"; assetPath: string; args?: string[] }
	| { type: "versions-upload"; args?: string[] }
	| { type: "versions-upload-assets"; assetPath: string; args?: string[] }
	| { type: "d1-migrations-apply"; database: string; args?: string[] };

interface WranglerExecutionOptions {
	source?: Directory;
	dist?: Directory;
	wranglerConfig?: File;
	wranglerPath?: string;
	cloudflareApiToken: Secret;
	command: WranglerCommand;
}

interface PreviewOptions {
	githubApiToken: Secret;
	repository: string;
	pullRequestNumber: string;
	commentPrefix: string;
}

interface ExecutionResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

// Constants
const NODE_IMAGE = "node:22";
const DEPLOY_WORKDIR = "/deploy";
const PREVIEW_URL_PATTERNS = [
	/Version preview URL:\s*(https:\/\/[^\s]+)/i,
	/https:\/\/[^\s]+\.workers\.dev/,
];

@object()
export class Cloudflare {
	/**
	 * Create a base container with wrangler cached and common environment setup
	 */
	private async createBaseContainer(cloudflareApiToken: Secret): Promise<Container> {
		const cloudflareAccountId = await dag.config().cloudflareAccountId();

		return dag
			.container()
			.from(NODE_IMAGE)
			.withWorkdir(DEPLOY_WORKDIR)
			// Cache wrangler installation
			.withExec(["npx", "wrangler", "--version"])
			.withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cloudflareAccountId)
			.withSecretVariable("CLOUDFLARE_API_TOKEN", cloudflareApiToken);
	}

	/**
	 * Mount source files to the container based on the provided options
	 */
	private async mountSources(
		container: Container,
		options: WranglerExecutionOptions,
	): Promise<Container> {
		// Get the wrangler config filename if provided
		const wranglerConfigName = options.wranglerConfig
			? await options.wranglerConfig.name()
			: undefined;

		// Chain all mount operations immutably
		return [
			// Mount source directory if provided
			(c: Container) => options.source
				? c.withMountedDirectory(DEPLOY_WORKDIR, options.source)
				: c,
			// Mount dist directory if provided
			(c: Container) => options.dist
				? c.withMountedDirectory(`${DEPLOY_WORKDIR}/dist`, options.dist)
				: c,
			// Mount wrangler config file if provided
			(c: Container) => options.wranglerConfig && wranglerConfigName
				? c.withMountedFile(`${DEPLOY_WORKDIR}/${wranglerConfigName}`, options.wranglerConfig)
				: c,
		].reduce((acc, fn) => fn(acc), container);
	}

	/**
	 * Build the wrangler command based on the command type
	 */
	private buildWranglerCommand(
		options: WranglerExecutionOptions,
		wranglerConfigName?: string,
	): string[] {
		const baseCommand = ["npx", "wrangler"];
		const configArgs = options.wranglerPath
			? ["--config", options.wranglerPath]
			: wranglerConfigName
			? ["--config", wranglerConfigName]
			: [];

		switch (options.command.type) {
			case "deploy":
				return [...baseCommand, "deploy", ...configArgs, ...(options.command.args || [])];
			
			case "deploy-assets":
				return [
					...baseCommand,
					"deploy",
					...configArgs,
					"--assets",
					options.command.assetPath,
					...(options.command.args || []),
				];
			
			case "versions-upload":
				return [
					...baseCommand,
					"versions",
					"upload",
					...configArgs,
					...(options.command.args || []),
				];
			
			case "versions-upload-assets":
				return [
					...baseCommand,
					"versions",
					"upload",
					...configArgs,
					"--assets",
					options.command.assetPath,
					...(options.command.args || []),
				];
			
			case "d1-migrations-apply":
				return [
					...baseCommand,
					...configArgs,
					"d1",
					"migrations",
					"apply",
					"--remote",
					options.command.database,
					...(options.command.args || []),
				];
		}
	}

	/**
	 * Execute a wrangler command with proper error handling
	 */
	private async executeWrangler(options: WranglerExecutionOptions): Promise<ExecutionResult> {
		// Build command
		const wranglerConfigName = options.wranglerConfig
			? await options.wranglerConfig.name()
			: undefined;
		const command = this.buildWranglerCommand(options, wranglerConfigName);

		// Create container pipeline
		const baseContainer = await this.createBaseContainer(options.cloudflareApiToken);
		const containerWithSources = await this.mountSources(baseContainer, options);
		const result = await containerWithSources.withExec(command);

		// Get execution results
		const [stdout, stderr, exitCode] = await Promise.all([
			result.stdout(),
			result.stderr(),
			result.exitCode(),
		]);

		return { stdout, stderr, exitCode };
	}

	/**
	 * Extract preview URL from wrangler output
	 */
	private extractPreviewUrl(output: string): string {
		for (const pattern of PREVIEW_URL_PATTERNS) {
			const match = output.match(pattern);
			if (match) {
				return match[1] || match[0];
			}
		}
		return "Preview URL not found";
	}

	/**
	 * Post a comment to a GitHub pull request
	 */
	private async postPullRequestComment(
		options: PreviewOptions,
		previewUrl: string,
	): Promise<void> {
		try {
			await dag
				.github()
				.postPullRequestComment(
					options.githubApiToken,
					options.repository,
					options.pullRequestNumber,
					`${options.commentPrefix}: ${previewUrl}`,
				)
				.exitCode();
		} catch (error) {
			console.log("Failed to post PR comment:", error);
		}
	}

	/**
	 * Deploy a backend service with worker script to Cloudflare Workers.
	 */
	@func()
	async deploy(
		source: Directory,
		wranglerPath: string,
		cloudflareApiToken: Secret,
	): Promise<string> {
		const result = await this.executeWrangler({
			source,
			wranglerPath,
			cloudflareApiToken,
			command: { type: "deploy" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Deployment failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		return result.stdout;
	}

	/**
	 * Apply migrations to a backend service with worker script to Cloudflare Workers.
	 */
	@func()
	async applyMigrations(
		source: Directory,
		wranglerPath: string,
		cloudflareApiToken: Secret,
	): Promise<string> {
		const result = await this.executeWrangler({
			source,
			wranglerPath,
			cloudflareApiToken,
			command: { type: "d1-migrations-apply", database: "DB" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Migration failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		return result.stdout;
	}

	/**
	 * Deploy a website with worker script to Cloudflare Workers.
	 */
	@func()
	async deployDist(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
	): Promise<string> {
		const result = await this.executeWrangler({
			dist,
			wranglerConfig,
			cloudflareApiToken,
			command: { type: "deploy" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Deployment failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		return result.stdout;
	}

	/**
	 * Deploy asset-only website to Cloudflare Workers.
	 */
	@func()
	async deployAssets(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
	): Promise<string> {
		const result = await this.executeWrangler({
			dist,
			wranglerConfig,
			cloudflareApiToken,
			command: { type: "deploy-assets", assetPath: "./dist" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Deployment failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		return result.stdout;
	}

	/**
	 * Deploy a preview website with worker script to Cloudflare Workers.
	 */
	@func()
	async preview(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
		githubApiToken: Secret,
		repository: string,
		pullRequestNumber: string,
	): Promise<string> {
		const result = await this.executeWrangler({
			dist,
			wranglerConfig,
			cloudflareApiToken,
			command: { type: "versions-upload" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Preview deployment failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		// Extract and post preview URL
		const previewUrl = this.extractPreviewUrl(result.stdout);
		await this.postPullRequestComment(
			{
				githubApiToken,
				repository,
				pullRequestNumber,
				commentPrefix: "Deployment Preview",
			},
			previewUrl,
		);

		return result.stdout;
	}

	/**
	 * Deploy a preview asset-only website to Cloudflare Workers.
	 */
	@func()
	async previewAssets(
		dist: Directory,
		wranglerConfig: File,
		cloudflareApiToken: Secret,
		githubApiToken: Secret,
		repository: string,
		pullRequestNumber: string,
	): Promise<string> {
		const result = await this.executeWrangler({
			dist,
			wranglerConfig,
			cloudflareApiToken,
			command: { type: "versions-upload-assets", assetPath: "./dist" },
		});

		if (result.exitCode !== 0) {
			throw new Error(
				`Preview deployment failed. Error: ${result.stdout}${result.stderr}`,
			);
		}

		// Extract and post preview URL
		const previewUrl = this.extractPreviewUrl(result.stdout);
		await this.postPullRequestComment(
			{
				githubApiToken,
				repository,
				pullRequestNumber,
				commentPrefix: "Storybook Preview",
			},
			previewUrl,
		);

		return result.stdout;
	}
}