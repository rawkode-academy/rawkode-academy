import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

@object()
class Shows {
	/**
	 * example usage: "dagger call db-migrate --env <env> stdout"
	 */
	@func()
	dbMigrate(env: string): Container {
		const a = dag
			.infisical()
			.getSecret("db-password", "token", "projectid", "env", {
				path: "/",
			});

		return dag.container().from("oven/bun:1").withExec(["echo", env]);
	}
}
