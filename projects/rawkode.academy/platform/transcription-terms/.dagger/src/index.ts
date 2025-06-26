import {
	argument,
	type Container,
	dag,
	type Directory,
	func,
	object,
} from "@dagger.io/dagger";

@object()
export class TranscriptionTerms {
	async install(
		@argument({ defaultPath: "." }) directory: Directory,
	): Promise<Container> {
		const bun = dag.bun();
		return await bun.withCache().installNoCache(directory);
	}

	/**
	 * Run tests for the service
	 */
	@func()
	async test(
		@argument({ defaultPath: "." }) directory: Directory,
	): Promise<Container> {
		const app = await this.install(directory);
		return app.withExec(["bun", "test"]);
	}

	/**
	 * Run tests with coverage for the service
	 */
	@func()
	async testCoverage(
		@argument({ defaultPath: "." }) directory: Directory,
	): Promise<Container> {
		const app = await this.install(directory);
		return app.withExec(["bun", "test", "--coverage"]);
	}
}
