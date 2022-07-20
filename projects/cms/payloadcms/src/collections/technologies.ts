import { CollectionConfig } from "payload/types";
import { isAdmin } from "../authUtils";
import Media from "./media";

const Technologies: CollectionConfig = {
  slug: "technologies",
  auth: false,
  labels: {
    singular: "Technology",
    plural: "Technologies",
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "openSource"],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "about",
      type: "richText",
    },
    {
      name: "website",
      type: "text",
    },
    {
      name: "docsWebsite",
      type: "text",
    },
    {
      name: "openSource",
      label: "Open Source",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "githubLink",
      type: "text",
      admin: {
        // Only show / request a GitHub link is the project is open-source
        condition: (data) => data.openSource,
      },
    },
    {
      name: "socialMedia",
      type: "group",
      fields: [
        {
          name: "twitterUsername",
          type: "text",
          unique: true,
        },
        {
          name: "youtubeUsername",
          type: "text",
          unique: true,
        },
      ],
    },
    {
      name: "hashtag",
      type: "text",
    },
  ],
};

export default Technologies;
