import { describe, expect, it, mock } from "bun:test";
import { getAuthProvider } from ".";
import { OpenIDAuth } from "@grafbase/sdk/dist/src/auth/openid";
import { JWTAuth } from "@grafbase/sdk/dist/src/auth/jwt";

describe("getAuthProvider", () => {
	it("should return OpenIDConnect provider in production environment", () => {
		process.env.GRAFBASE_ENV = "production";

		const graph = {
			env: mock((key: string) => {
				switch (key) {
					case "OIDC_ISSUER_URL":
						return "https://example.com/oidc";
				}
			}),
		};

		const provider = getAuthProvider(graph);

		expect(provider).toBeDefined();
		expect(provider).toBeInstanceOf(OpenIDAuth);
		expect(provider).toHaveProperty("issuer", "https://example.com/oidc");
	});

	it("should return JWT provider in non-production environment", () => {
		process.env.GRAFBASE_ENV = "development";
		const graph = {
			env: mock((key: string) => {
				switch (key) {
					case "JWT_ISSUER":
						return "https://example.com/jwt/issuer";
					case "JWT_SECRET":
						return "jwt_secret";
				}
			}),
		};

		const provider = getAuthProvider(graph);

		expect(provider).toBeDefined();
		expect(provider).toBeInstanceOf(JWTAuth);
		expect(provider).toHaveProperty("issuer", "https://example.com/jwt/issuer");
		expect(provider).toHaveProperty("secret", "jwt_secret");
	});
});
