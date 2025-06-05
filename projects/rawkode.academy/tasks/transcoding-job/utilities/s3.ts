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
