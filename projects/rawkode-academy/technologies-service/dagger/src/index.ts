import {
	argument,
	dag,
	Directory,
	func,
	object,
	Service,
} from "@dagger.io/dagger";

@object()
class TechnologiesService {
	@func()
	async dev(
		@argument({ defaultPath: ".." }) directory: Directory
	): Promise<Service> {
		const sqld = dag.sqld().run({
			port: 5000,
		});

		await dag
			.nodejs()
			.withBun(directory)
			.withExec(["bun", "install"])
			.withServiceBinding("sqld", sqld)
			.withExec(["bash", "-c", "cd drizzle && bun migrate.ts"])
			.withExec(["bash", "-c", "cd drizzle && bun seed.ts"])
			.sync();

		return sqld;
	}
}
