import { CollectionConfig } from "payload/types";
import { socialMediaFields } from "../social";
import { Logo } from "../media";
import { RowLabelFunction } from "payload/dist/admin/components/forms/RowLabel/types";
import { slugField } from "../../fields/slug";

export const Technologies: CollectionConfig = {
  slug: "technologies",
  admin: {
    useAsTitle: "name",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "logo",
      type: "upload",
      relationTo: Logo.slug,
    },
    {
      name: "description",
      type: "richText",
      required: true,
    },
    {
      name: "hashtag",
      type: "text",
    },
    {
      name: "homepage",
      type: "text",
      required: true,
    },
    {
      name: "documentation",
      type: "text",
      required: true,
    },
    socialMediaFields,
    {
      name: "openSource",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "openSourceDetails",
      type: "group",
      admin: {
        condition: (data) => {
          if (data.openSource) {
            return true;
          }
          return false;
        },
      },
      fields: [
        {
          name: "repository",
          type: "text",
          required: true,
        },
      ],
    },
    slugField(),
  ],
  timestamps: false,
};
