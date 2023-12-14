import { createAstroRoute } from "@trigger.dev/astro";
import { client } from "../../trigger";
import "../../jobs";

export const prerender = false;
export const { POST } = createAstroRoute(client);
