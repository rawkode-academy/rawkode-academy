import { Redirects } from "./types";

import rawkodeAcademy from "./rawkode.academy";
import rawkodeCommunity from "./rawkode.community";

const redirects: Redirects = {
  defaultRedirect: "https://twitter.com/rawkode",
  domains: {
    "rawkode.academy": rawkodeAcademy,
    "rawkode.community": rawkodeCommunity,
  },
};

addEventListener("fetch", async (event: FetchEvent) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  // const cacheKey = new Request(requestUrl.toString(), request);

  event.waitUntil(logRequest());

  // const cache = caches.default;
  // const cachedResponse = await cache.match(cacheKey);

  // if (cachedResponse) {
  //   return event.respondWith(cachedResponse);
  // }

  return event.respondWith(handleRequest(requestUrl));
});

const handleRequest = async (requestUrl: URL) => {
  const hostname = requestUrl.host;
  const path = requestUrl.pathname.substring(1);

  console.log(`Handling request on domain '${hostname}' for '${path}'`);

  if (!(hostname in redirects["domains"])) {
    console.log("This domain is not managed by web-links");
    return Response.redirect(redirects.defaultRedirect);
  }

  const domain = redirects["domains"][hostname];

  if (path in domain["redirects"]) {
    console.log(`Redirecting too '${domain["redirects"][path].to}'`);
    return Response.redirect(domain["redirects"][path].to);
  }

  console.log("Path not found, default redirect");
  return Response.redirect(domain.defaultRedirect);
};

const logRequest = async () => {};
