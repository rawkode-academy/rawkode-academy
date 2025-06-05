import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UploadFileOptions extends S3Config {
  key: string;
  filePath: string;
  contentType?: string;
}

export async function uploadFile(options: UploadFileOptions): Promise<void> {
  const { endpoint, bucket, accessKeyId, secretAccessKey, key, filePath, contentType } = options;

  const client = new S3Client({
    endpoint,
    region: "auto",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const fileContent = await Deno.readFile(filePath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  await client.send(command);
}