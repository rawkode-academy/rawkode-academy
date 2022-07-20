import { IncomingUploadType } from "payload/dist/uploads/types";
import { CollectionConfig } from "payload/types";

interface IncomingUploadTypeS3 extends IncomingUploadType {
  s3: {
    bucket: string;
    prefix: string;
    commandInput: {
      ACL: string;
    };
  };
}

type UploadType = IncomingUploadTypeS3 | boolean;

export interface S3CollectionConfig extends CollectionConfig {
  upload: UploadType;
}

const Media: S3CollectionConfig = {
  slug: "media",
  upload: {
    staticURL: "/assets",
    staticDir: "assets",
    disableLocalStorage: true,
    s3: {
      bucket: "golem-uploads-bucket",
      prefix: "images", // files will be stored in bucket folder images/xyz
      // prefix: ({ doc }) => `assets/${doc.type}`, // dynamic prefixes are possible too
      commandInput: {
        // optionally, use here any valid PutObjectCommandInput property
        // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/putobjectcommandinput.html
        ACL: "public-read",
      },
    },
    adminThumbnail: ({ doc }) =>
      `https://golem-uploads-bucket.s3.eu-west-2.amazonaws.com/images/${doc.filename}`,
  },
  // create a field to access uploaded files in s3 from payload api
  fields: [
    {
      name: "url",
      type: "text",
      access: {
        create: () => false,
      },
      admin: {
        disabled: true,
      },
      hooks: {
        afterRead: [
          ({ data: doc }) =>
            `https://golem-uploads-bucket.s3.eu-west-2.amazonaws.com/images/${doc.filename}`,
        ],
      },
    },
  ],
};

export default Media;
