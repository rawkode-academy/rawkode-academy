import { buildConfig } from "payload/config";
import path from "path";
import Categories from "./collections/Categories";
import Posts from "./collections/Posts";
import Tags from "./collections/Tags";
import Media from "./collections/Media";
import { Shows, Episodes } from "./collections/shows";
import { Technologies } from "./collections/technologies";
import { People } from "./collections/people";

export default buildConfig({
  serverURL: "http://localhost:3000",
  admin: {
    user: People.slug,
  },
  collections: [People, Categories, Posts, Tags, Media, Shows, Episodes, Technologies],
  typescript: {
    outputFile: path.resolve(__dirname, "payload-types.ts"),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, "generated-schema.graphql"),
  },
});
