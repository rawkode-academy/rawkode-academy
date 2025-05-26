import { Hono } from "hono";
import { provisionUser } from "./handlers/provision";
import { updateUser } from "./handlers/update";
import type { Env } from "./types";
import { ZitadelClient } from "./zitadel";
import { ZulipClient } from "./zulip";

type Variables = {
	zulipClient: ZulipClient;
	zitadelClient: ZitadelClient;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/api/*", async (c, next) => {
	const zulipClient = new ZulipClient({
		site: c.env.ZULIP_SITE,
		email: c.env.ZULIP_BOT_EMAIL,
		apiKey: c.env.ZULIP_API_KEY,
	});

	const zitadelClient = new ZitadelClient({
		domain: c.env.ZITADEL_DOMAIN,
		apiToken: c.env.ZITADEL_API_TOKEN,
	});

	c.set("zulipClient", zulipClient);
	c.set("zitadelClient", zitadelClient);
	await next();
});

app.post("/api/users/provision", provisionUser);
app.patch("/api/users/update", updateUser);

export default app;
