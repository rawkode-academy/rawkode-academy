import { Zitadel } from "@/lib/zitadel";
import { pathToRegexp } from "@clerk/shared/pathToRegexp";
import { defineMiddleware, sequence } from "astro:middleware";

// HINT: https://github.com/clerk/javascript/blob/main/packages/astro/src/server/route-matcher.ts
type WithPathPatternWildcard<T = string> = `${T & string}(.*)`;
type Autocomplete<U extends T, T = string> = U | (T & Record<never, never>);
type RouteMatcherRoutes = Autocomplete<WithPathPatternWildcard>;
type RouteMatcherParam =
  | Array<RegExp | RouteMatcherRoutes>
  | RegExp
  | RouteMatcherRoutes;

const createRouteMatcher = (routes: RouteMatcherParam) => {
  const routePatterns = [routes || ""].flat().filter(Boolean);
  const matchers = precomputePathRegex(routePatterns);

  return (request: Request) =>
    matchers.some((matcher) => matcher.test(new URL(request.url).pathname));
};

const precomputePathRegex = (patterns: Array<string | RegExp>) => {
  return patterns.map((
    pattern,
  ) => (pattern instanceof RegExp ? pattern : pathToRegexp(pattern)));
};

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const zitadel = new Zitadel();

export const authMiddleware = defineMiddleware(async (context, next) => {
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
    console.debug("No access token, skipping middleware");
    return next();
  }

  const idToken = context.cookies.get("idToken")?.value;
  const refreshToken = context.cookies.get("refreshToken")?.value;

  const user = await zitadel.fetchUser(
    accessToken.value,
    idToken,
    refreshToken,
  );

  if (!user) {
    console.debug("No user, redirecting to logout");
    return context.redirect("/api/auth/logout");
  }

  context.locals.user = user;

  return next();
});

export const secureRoutesMiddleware = defineMiddleware(
  async (context, next) => {
    if (isAdminRoute(context.request)) {
      const user = context.locals.user;

      if (!user) {
        return context.redirect("/");
      }

      if (user.roles.includes("director")) {
        return next();
      } else {
        return context.redirect("/");
      }
    }

    return next();
  },
);

export const onRequest = sequence(secureRoutesMiddleware, authMiddleware);
