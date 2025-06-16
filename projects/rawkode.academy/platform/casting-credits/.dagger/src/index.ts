import {
	argument,
	type Container,
	dag,
	type Directory,
	func,
	object,
} from "@dagger.io/dagger";

@object()
export class CastingCredits {
		async install(
			@argument({ defaultPath: "." }) directory: Directory,
			devDependencies = false,
		): Promise<Container> {
			const bun = dag.bun();
			return await bun.withCache().install(directory, {
				devDependencies,
			});
		}

		/**
		 * Run tests for the casting-credits service
		 */
		@func()
		async test(
			@argument({ defaultPath: "." }) directory: Directory,
		): Promise<Container> {
			const app = (await this.install(directory, true)).withExec([
				"bun",
				"test",
			]);
			return app.withExec(["bun", "test"]);
		}

		/**
		 * Run tests with coverage for the casting-credits service
		 */
		@func()
		async testCoverage(
			@argument({ defaultPath: "." }) directory: Directory,
		): Promise<Container> {
			const app = await this.install(directory, true);
			return app.withExec(["bun", "test", "--coverage"]);
		}
	}
