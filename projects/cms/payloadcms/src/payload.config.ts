import { buildConfig } from "payload/config";
import path from "path";
import s3Upload from "payload-s3-upload";

import People from "./collections/people";
import Shows from "./collections/shows";
import Technologies from "./collections/technologies";
import LiveStreams from "./collections/live-streams";
import Media from "./collections/media";

//
export default buildConfig({
  serverURL: "http://localhost:3000",
  admin: {
    user: People.slug,
  },
  collections: [People, Shows, Technologies, LiveStreams, Media],
  typescript: {
    outputFile: path.resolve(__dirname, "payload-types.ts"),
  },
  plugins: [
    s3Upload({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET,
      },
    }),
  ],
});
