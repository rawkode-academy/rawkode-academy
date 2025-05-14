import { dag, Service, object, func } from "@dagger.io/dagger";

@object()
class Restate {
	/**
	 * Returns a container that echoes whatever string argument is provided
	 */
	@func()
	service(image = "restatedev/restate", tag = "latest"): Service {
		return dag
			.container()
			.from(`${image}:${tag}`)
			.withExposedPort(8080)
			.withExposedPort(9070)
			.withExposedPort(9071)
			.asService();
	}
}
