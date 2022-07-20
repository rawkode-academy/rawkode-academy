import { CollectionConfig } from "payload/types";
import { isAdmin } from "../authUtils";

const canAccessUser = (args) => {
  const {
    req: { user },
  } = args;

  if (isAdmin(args)) {
    return true;
  }

  return {
    id: {
      equals: user.id,
    },
  };
};

const People: CollectionConfig = {
  slug: "people",
  auth: true,
  labels: {
    singular: "Person",
    plural: "People",
  },
  admin: {
    defaultColumns: ["name"],
    useAsTitle: "name",
  },
  access: {
    read: canAccessUser,

    unlock: isAdmin,
    create: isAdmin,

    delete: isAdmin,
    update: canAccessUser,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      options: ["admin", "guest"],
      defaultValue: "guest",
      access: {
        create: isAdmin,
        update: isAdmin,
      },
    },
    {
      name: "about",
      type: "richText",
    },
    {
      name: "socialMedia",
      type: "group",
      fields: [
        {
          name: "githubUsername",
          type: "text",
          required: true,
          unique: true,
        },
        {
          name: "twitterUsername",
          type: "text",
          unique: true,
        },
        {
          name: "linkedinUsername",
          type: "text",
          unique: true,
        },
        {
          name: "youtubeUsername",
          type: "text",
          unique: true,
        },
        {
          name: "facebookUsername",
          type: "text",
          unique: true,
        },
        {
          name: "tiktokUsername",
          type: "text",
          unique: true,
        },
      ],
    },
    {
      name: "additionalLinks",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
        },
        {
          name: "URL",
          type: "text",
        },
      ],
    },
  ],
};

export default People;
