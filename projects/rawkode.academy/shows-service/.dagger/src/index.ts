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
			.container()
			.from("denoland/deno")
			.withEnvVariable("LIBSQL_URL", "http://libsql:2000")
			.withEnvVariable("LIBSQL_TOKEN", "")
			.withServiceBinding("libsql", libsql)
			.withMountedDirectory("/code", source)
			.withWorkdir("/code/data-model")
			.withExec(["deno", "run", "--allow-read=./migrations", "--allow-net=libsql:2000", "--allow-env=LIBSQL_URL,LIBSQL_TOKEN", "migrate.ts"])
			.stdout();

		return libsql;
	}
}
