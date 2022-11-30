import { CollectionConfig } from "payload/types";

export const isAdmin = ({ req: { user } }) => user.role === "admin";

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

export const People: CollectionConfig = {
  slug: "people",
  auth: true,
  labels: {
    singular: "Person",
    plural: "People",
  },
  admin: {
    defaultColumns: ["name", "email"],
    useAsTitle: "name",
  },
  access: {
    read: canAccessUser,
    update: canAccessUser,

    unlock: isAdmin,
    create: isAdmin,
    delete: isAdmin,
  },
  fields: [
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
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "socialMedia",
      type: "group",
      fields: [
        {
          name: "githubHandle",
          type: "text",
          required: true,
          unique: true,
        },
        {
          name: "twitterHandle",
          type: "text",
          unique: true,
        },
        {
          name: "linkedinHandle",
          type: "text",
          unique: true,
        },
        {
          name: "youtubeHandle",
          type: "text",
          unique: true,
        },
        {
          name: "facebookHandle",
          type: "text",
          unique: true,
        },
        {
          name: "tiktokHandle",
          type: "text",
          unique: true,
        },
      ],
    },
    {
      name: "about",
      type: "richText",
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
