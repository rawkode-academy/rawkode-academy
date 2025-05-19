import { defineMiddleware, sequence } from "astro:middleware";
import { Zitadel } from "@/lib/zitadel";

const zitadel = new Zitadel();

// URLs that should be bypassed from authentication
const bypassUrls = ["/api/webhooks/livekit", "/api/auth/logout"];

const authMiddleware = defineMiddleware(async (context, next) => {
	// The runtime isn't available for pre-rendered pages and we
	// only want this middleware to run for SSR.
	if (!("runtime" in context.locals)) {
		return next();
	}

	if (bypassUrls.includes(context.request.url)) {
		return next();
	}

	const accessToken = context.cookies.get("accessToken");

	if (!accessToken) {
		return next();
	}

	const idToken = context.cookies.get("idToken")?.value;

	const user = await zitadel.fetchUser(idToken);

	if (!user) {
		return context.redirect("/api/auth/logout");
	}

	context.locals.user = user;

	return next();
});

export const onRequest = sequence(authMiddleware);
