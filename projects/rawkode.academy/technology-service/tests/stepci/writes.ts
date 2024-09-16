import { expect, test } from "bun:test";
import { run } from "@stepci/runner";

test("id not allowed during create", async () => {
	const workflow = {
		version: "1.1",
		name: "id not allowed during create",
		env: {
			host: import.meta.env.RPC_HOST as string,
		},
		tests: {
			example: {
				steps: [
					{
						name: "Create with ID",
						http: {
							url: "https://${{env.host}}",
							method: "POST",
							json: {
								id: "kubernetes",
								name: "Kubernetes",
								description: "Kubernetes",
							},
							check: {
								status: "/^40/",
							},
						},
					},
				],
			},
		},
	};

	const { result } = await run(workflow);
	expect(result.passed).toBe(true);
});
