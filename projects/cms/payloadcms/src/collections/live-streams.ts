import { CollectionConfig } from "payload/types";
import { isAdmin } from "../authUtils";

const LiveStreams: CollectionConfig = {
  slug: "live-streams",
  auth: false,
  labels: {
    singular: "Live Stream",
    plural: "Live Streams",
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "startDateTime"],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "show",
      type: "relationship",
      relationTo: "shows",
      hasMany: false,
      required: true,
    },
    {
      name: "startDateTime",
      type: "date",
      required: true,
    },
    {
      name: "guests",
      type: "relationship",
      relationTo: "people",
      hasMany: true,
    },
    {
      name: "technologies",
      type: "relationship",
      relationTo: "technologies",
      hasMany: true,
    },
    {
      name: "youTubeId",
      type: "text",
      label: "YouTube ID",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "chapters",
      type: "array",
      defaultValue: [
        {
          title: "Holding Screen",
          time: "00:00",
        },
      ],
      fields: [
        {
          name: "title",
          type: "text",
        },
        {
          name: "time",
          type: "text",
        },
      ],
    },
    {
      name: "links",
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

export default LiveStreams;
