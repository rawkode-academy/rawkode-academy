import { dag, object, func, Container } from "@dagger.io/dagger";
import { expect } from "bun:test";

@object()
class Tests {
	/**
	 * Run Integration Tests
	 */
	@func()
	async testDefaultPort() {
		const sqld = dag.sqld().run();

		const curlOutput = await dag
			.container()
			.from("curlimages/curl:latest")
			.withServiceBinding("sqld", sqld)
			.withExec(["curl", "-v", "http://sqld:8080/health"])
			.stderr();

		expect(curlOutput).toContain("HTTP/1.1 200 OK");
	}

	/**
	 * Run Integration Tests
	 */
	@func()
	async testCustomPort() {
		const sqld = dag.sqld().run({
			port: 5000,
		});

		const curlOutput = await dag
			.container()
			.from("curlimages/curl:latest")
			.withServiceBinding("sqld", sqld)
			.withExec(["curl", "-v", "http://sqld:5000/health"])
			.stderr();

		expect(curlOutput).toContain("HTTP/1.1 200 OK");
	}
}
