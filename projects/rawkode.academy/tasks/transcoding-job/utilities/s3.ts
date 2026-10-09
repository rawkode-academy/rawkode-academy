import {
  GetObjectCommand,
  GetObjectCommandInput,
  HeadObjectCommand,
  HeadObjectCommandInput,
  NoSuchKey,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync, expandGlob } from "@std/fs";
import { join, relative } from "@std/path";
import { createReadStream } from "node:fs";
import { quoteEtag, sameEtag } from "./review.ts";

export const downloadFromS3 = async (
  s3: S3Client,
  bucketName: string,
  remoteKey: string,
  localPath: string,
) => {
  console.log(`Checking S3 download for ${remoteKey} to ${localPath}...`);

  try {
    // Check remote object metadata first
    // Note: Using HeadObject to check size is simpler than calculating a local ETag
    // for an If-None-Match conditional GET, unless the ETag is already known from a previous download.
    const headInput: HeadObjectCommandInput = {
      Bucket: bucketName,
      Key: remoteKey,
    };
    const headCommand = new HeadObjectCommand(headInput);
    const metadata = await s3.send(headCommand);
    const remoteSize = metadata.ContentLength;

    // Check if local file exists and compare size
    if (existsSync(localPath)) {
      const localStat = await Deno.stat(localPath);
      if (localStat.size === remoteSize) {
        console.log(
          `Local file ${localPath} exists and matches remote size (${remoteSize} bytes). Skipping download.`,
        );
        return; // Skip download
      } else {
        console.log(
          `Local file ${localPath} exists but size (${localStat.size}) differs from remote (${remoteSize}). Proceeding with download.`,
        );
      }
    } else {
      console.log(
        `Local file ${localPath} does not exist. Proceeding with download.`,
      );
    }

    // Proceed with download if local file doesn't exist or size differs
    console.log(
      `Downloading s3://${bucketName}/${remoteKey} to ${localPath}...`,
    );
    const getInput: GetObjectCommandInput = {
      Bucket: bucketName,
      Key: remoteKey,
    };
    const getCommand = new GetObjectCommand(getInput);
    const response = await s3.send(getCommand);

    if (!response.Body) {
      throw new Error("S3 GetObject response has no body.");
    }

    // Ensure directory exists before writing
    // const localDir = dirname(localPath); // Requires import { dirname } from "@std/path";
    // await Deno.mkdir(localDir, { recursive: true }); // Ensure directory exists

    await Deno.writeFile(
      localPath,
      await response.Body.transformToByteArray(),
    );
    console.log(`Successfully downloaded ${remoteKey} to ${localPath}.`);
  } catch (error) {
    if (error instanceof NoSuchKey) {
      console.error(
        `Remote object s3://${bucketName}/${remoteKey} not found. Cannot download.`,
      );
      // Decide if this should throw or just log
      throw error;
    } else {
      console.error(`Failed to download ${remoteKey}: ${error}`);
      throw error; // Re-throw other errors
    }
  }
};

/**
 * Uploads all files from a local directory recursively to an S3 bucket under a specified prefix.
 * @param s3 - The S3Client instance.
 * @param bucketName - The name of the S3 bucket.
 * @param localDirectory - The path to the local directory to upload.
 * @param s3Prefix - The prefix (folder path) in the S3 bucket where files should be uploaded.
 */
export const uploadDirectoryToS3 = async (
  s3: S3Client,
  bucketName: string,
  localDirectory: string,
  s3Prefix: string,
) => {
  console.log(
    `Uploading directory ${localDirectory} to s3://${bucketName}/${s3Prefix}...`,
  );

  try {
    for await (
      const entry of expandGlob(`${localDirectory}/**/*`, {
        globstar: true,
        includeDirs: false,
      })
    ) {
      if (entry.isFile) {
        const localPath = entry.path;
        // Calculate the relative path within the source directory
        const relativePath = relative(localDirectory, localPath);
        // Construct the S3 key using the prefix and the relative path
        // Ensure forward slashes for S3 keys, even on Windows
        const remoteKey = join(s3Prefix, relativePath).replace(/\\/g, "/");

        // Upload each file sequentially
        await uploadToS3(s3, bucketName, localPath, remoteKey);
      }
    }

    console.log(
      `Successfully uploaded directory ${localDirectory} to ${s3Prefix}.`,
    );
  } catch (error) {
    console.error(`Failed to upload directory ${localDirectory}: ${error}`);
    // Depending on requirements, you might want to handle partial failures
    // For now, re-throw the error if any part of the process fails
    throw error;
  }
};

export const uploadToS3 = async (
  s3: S3Client,
  bucketName: string,
  localPath: string,
  remoteKey: string,
) => {
  console.log(`Uploading ${localPath} to s3://${bucketName}/${remoteKey}...`);
  const fileContent = await Deno.readFile(localPath);
  const putInput: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: remoteKey,
    Body: fileContent,
    ACL: "public-read",
  };

  const command = new PutObjectCommand(putInput);
  await s3.send(command);
  console.log(
    `Successfully uploaded ${localPath} to s3://${bucketName}/${remoteKey}.`,
  );
};

/**
 * Streams one object to disk, pinned to an ETag with If-Match, so the bytes on
 * disk are provably the object the caller pinned. Used by the Studio review modes;
 * downloadFromS3 above stays the HLS path.
 */
export const downloadFromS3ToFile = async (
  s3: S3Client,
  bucketName: string,
  remoteKey: string,
  localPath: string,
  options: { ifMatch: string; maxBytes?: number },
): Promise<{ bytes: number; etag: string }> => {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
      IfMatch: quoteEtag(options.ifMatch),
    }),
  );
  if (!sameEtag(response.ETag, options.ifMatch)) {
    throw new Error(`Source ${remoteKey} does not match the pinned ETag`);
  }
  const bytes = response.ContentLength ?? 0;
  if (options.maxBytes !== undefined && bytes > options.maxBytes) {
    await response.Body?.transformToWebStream().cancel();
    throw new Error(
      `Source ${remoteKey} is ${bytes} bytes, above the ${options.maxBytes} byte limit`,
    );
  }
  if (!response.Body) {
    throw new Error("S3 GetObject response has no body.");
  }
  const file = await Deno.open(localPath, {
    create: true,
    truncate: true,
    write: true,
  });
  await response.Body.transformToWebStream().pipeTo(file.writable);
  const written = (await Deno.stat(localPath)).size;
  if (written !== bytes) {
    throw new Error(`Downloaded ${written} of ${bytes} bytes for ${remoteKey}`);
  }
  console.log(`Downloaded s3://${bucketName}/${remoteKey} (${bytes} bytes).`);
  return { bytes, etag: response.ETag ?? "" };
};

/**
 * Writes a private, write-once object. If-None-Match: * makes a second writer
 * fail instead of replacing bytes that another system may already have pinned.
 */
export const uploadPrivateOnce = async (
  s3: S3Client,
  bucketName: string,
  localPath: string,
  remoteKey: string,
  contentType: string,
): Promise<{ bytes: number; etag: string }> => {
  const bytes = (await Deno.stat(localPath)).size;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: remoteKey,
      Body: createReadStream(localPath),
      ContentLength: bytes,
      ContentType: contentType,
      IfNoneMatch: "*",
    }),
  );
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucketName, Key: remoteKey }),
  );
  if (!head.ETag || head.ContentLength !== bytes) {
    throw new Error(`Uploaded ${remoteKey} does not match the local file`);
  }
  return { bytes, etag: head.ETag.replace(/^"|"$/g, "") };
};
