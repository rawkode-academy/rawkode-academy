import { CollectionConfig } from "payload/types";
import { isAdmin } from "../authUtils";

const Shows: CollectionConfig = {
  slug: "shows",
  auth: false,
  labels: {
    singular: "Show",
    plural: "Shows",
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "host"],
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
      name: "host",
      type: "relationship",
      relationTo: "people",
      hasMany: true,
    },
    {
      name: "website",
      type: "text",
    },
    {
      name: "hashtag",
      type: "text",
    },
  ],
};

export default Shows;
