import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema.ts";

const yoga = createYoga({
  schema: getSchema(),
  graphqlEndpoint: "/",
});

const port = Deno.env.get("PORT") || "8000";

Deno.serve({
  port: Number(port),
  onListen: ({ hostname, port, transport }) => {
    console.log(`Listening on ${transport}://${hostname}:${port}`);
  },
}, yoga.fetch);
