import { Zitadel } from "@/lib/zitadel";
import { defineMiddleware, sequence } from "astro:middleware";

const zitadel = new Zitadel();

const authMiddleware = defineMiddleware(async (context, next) => {
  // The runtime isn't available for pre-rendered pages and we
  // only want this middleware to run for SSR.
  if (!("runtime" in context.locals)) {
    return next();
  }

  if (context.request.url.endsWith("/api/auth/logout")) {
    return next();
  }

  const accessToken = context.cookies.get("accessToken");

  if (!accessToken) {
    return next();
  }

  const idToken = context.cookies.get("idToken")?.value;

  const user = await zitadel.fetchUser(
    idToken,
  );

  if (!user) {
    return context.redirect("/api/auth/logout");
  }

  context.locals.user = user;

  return next();
});

export const onRequest = sequence(authMiddleware);
