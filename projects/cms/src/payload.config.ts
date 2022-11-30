import { buildConfig } from "payload/config";
import path from "path";
import { People } from "./people";

export default buildConfig({
  serverURL: "http://localhost:3000",
  admin: {
    user: People.slug,
  },
  collections: [People],
  typescript: {
    outputFile: path.resolve(__dirname, "payload-types.ts"),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, "generated-schema.graphql"),
  },
});
