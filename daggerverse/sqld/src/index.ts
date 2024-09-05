import { dag, object, func, type Service } from "@dagger.io/dagger";

@object()
class Sqld {
	@func()
	port = 8080;

	/**
	 * Run a sqld server
	 */
	@func()
	async service(port?: number): Promise<Service> {
		return dag
			.container()
			.from("ghcr.io/tursodatabase/libsql-server:latest")
			.withExposedPort(port || this.port)
			.withExec([
				"sqld",
				"--enable-http-console",
				"--http-listen-addr",
				`0.0.0.0:${port || this.port}`,
			])
			.asService();
	}
}
