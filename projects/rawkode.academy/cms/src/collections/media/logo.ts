import { ImageUploadFormatOptions } from "payload/dist/uploads/types";
import type { CollectionConfig } from "payload/types";

const formatOptions: ImageUploadFormatOptions = {
  format: "webp",
};

export const Logo: CollectionConfig = {
  slug: "logo",
  upload: {
    disableLocalStorage: false,
    adminThumbnail: "thumbnail",
    imageSizes: [
      {
        name: "thumbnail",
        height: 400,
        width: 400,
        crop: "center",
        formatOptions,
      },
      {
        name: "sq960",
        width: 960,
        height: 960,
        crop: "center",
        formatOptions,
      },
      {
        name: "sq1440",
        width: 1440,
        height: 1440,
        crop: "center",
        formatOptions,
      },
      {
        name: "sq1920",
        width: 1920,
        height: 1920,
        crop: "center",
        formatOptions,
      },
    ],
  },
  fields: [],
};
