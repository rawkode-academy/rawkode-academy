import {
  createRemoteJwksSigningKeyProvider,
  extractFromHeader,
  useJWT,
} from "@graphql-yoga/plugin-jwt";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema.ts";

const yoga = createYoga({
  schema: getSchema(),
  plugins: [
    useJWT({
      singingKeyProviders: [
        createRemoteJwksSigningKeyProvider({
          jwksUri: "https://zitadel.rawkode.academy/oauth/v2/keys",
        }),
      ],
      tokenLookupLocations: [
        extractFromHeader({ name: "authorization", prefix: "Bearer" }),
      ],
      // tokenVerification: {
      //   audience: 'my-audience',
      // },
      extendContext: true,
      reject: {
        missingToken: false,
        invalidToken: false,
      },
    }),
  ],
});

const port = Deno.env.get("PORT") || "8000";

Deno.serve({
  port: Number(port),
  onListen: ({ hostname, port, transport }) => {
    console.log(`Listening on ${transport}://${hostname}:${port}`);
  },
}, yoga.fetch);
