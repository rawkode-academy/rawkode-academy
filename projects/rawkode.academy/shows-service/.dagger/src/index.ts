import type { Directory, Service } from "@dagger.io/dagger";
import { dag, object, func, argument } from "@dagger.io/dagger";

@object()
class ShowsService {
	/**
	 * Local Dev
	 */
	@func()
	async dev(
		@argument({ defaultPath: ".", ignore: [".dagger", "node_modules"] })
		source: Directory,
	): Promise<Service> {
		const libsql = dag.sqld().service({
			port: 2000,
		});

		await dag
			.nodeJs()
			.withBun(source)
			.withExec(["ls"])
			// .withEnvVariable("LIBSQL_URL", "http://libsql:8080")
			// .withEnvVariable("LIBSQL_TOKEN", "")
			// .withServiceBinding("libsql", libsql)
			// .withExec(["bun", "data-model/migrate.ts"])
			.stdout();

		return libsql;
	}
}
