import { auth } from "@grafbase/sdk";
import type { Graph } from "@grafbase/sdk/dist/src/grafbase-schema";

export const getAuthProvider = (g: Graph) => {
	if (process.env.GRAFBASE_ENV === "production") {
		return auth.OpenIDConnect({
			issuer: g.env("OIDC_ISSUER_URL"),
		});
	}

	return auth.JWT({
		issuer: g.env("JWT_ISSUER"),
		secret: g.env("JWT_SECRET"),
	});
};
