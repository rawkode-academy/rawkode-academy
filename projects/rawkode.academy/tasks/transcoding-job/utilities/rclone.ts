import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

/**
 * S3 Credentials and configuration for rclone.
 */
export interface S3Credentials {
  accessKey: string;
  secretKey: string;
  endpoint: string; // e.g., "s3.amazonaws.com" or "your-region.digitaloceanspaces.com"
  bucketName: string;
  pathPrefix?: string; // Optional path within the bucket, e.g., "videos/processed"
  region?: string; // Optional region, e.g., "us-east-1"
}

/**
 * Copies a local directory to an S3 bucket using rclone with dynamic configuration.
 * Unlike sync, this will not delete files in the destination that don't exist in the source.
 *
 * @param localPath The path to the local directory to copy.
 * @param s3Config S3 credentials and bucket information.
 * @throws {Error} If the rclone command fails or config creation fails.
 */
export async function syncDirectoryToS3(
  localPath: string,
  s3Config: S3Credentials,
): Promise<void> {
  const tempDir = await Deno.makeTempDir({ prefix: "rclone_config_" });
  const tempConfigPath = path.join(tempDir, "rclone.conf");
  const remoteName = "tempS3"; // Name for the temporary remote in the config

  // Construct the S3 destination path
  const s3Destination = `${remoteName}:${s3Config.bucketName}${
    s3Config.pathPrefix ? `/${s3Config.pathPrefix.replace(/^\/+/, '')}` : "" // Ensure single slash prefix if exists
  }`;

  console.info(`Copying directory '${localPath}' to S3 destination '${s3Destination}'...`);

  // Generate rclone config content
  const rcloneConfigContent = `
[${remoteName}]
type = s3
provider = Other
env_auth = false
access_key_id = ${s3Config.accessKey}
secret_access_key = ${s3Config.secretKey}
endpoint = ${s3Config.endpoint}
region = ${s3Config.region ? s3Config.region : "auto"}
acl = public-read
`;
// Consider adding other relevant S3 options like storage_class if needed

  try {
    // Write the temporary config file
    await Deno.writeTextFile(tempConfigPath, rcloneConfigContent);
    console.debug(`Temporary rclone config written to: ${tempConfigPath}`);

    // Ensure local path exists (rclone might error otherwise)
    await ensureDir(localPath);

    const command = new Deno.Command("rclone", {
      args: [
        "copy",
        localPath,
        s3Destination,
        "--config",
        tempConfigPath,
        "--progress",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    let stderrOutput = "";
    const decoder = new TextDecoder();

    // Capture stdout and stderr
    const stdoutPromise = process.stdout.pipeTo(
      new WritableStream({
        write(chunk) {
          console.debug(`rclone stdout: ${decoder.decode(chunk)}`);
        },
      }),
    );
    const stderrPromise = process.stderr.pipeTo(
      new WritableStream({
        write(chunk) {
          const errorChunk = decoder.decode(chunk);
          console.error(`rclone stderr: ${errorChunk}`);
          stderrOutput += errorChunk; // Accumulate stderr
        },
      }),
    );

    // Wait for streams to close and process to exit
    const [status] = await Promise.all([
      process.status,
      stdoutPromise,
      stderrPromise,
    ]);

    if (!status.success) {
      throw new Error(
        `rclone copy failed with code ${status.code}. Stderr: ${stderrOutput}`,
      );
    }

    console.info(`Successfully copied directory '${localPath}' to S3 bucket '${s3Config.bucketName}'.`);

  } catch (error) {
    console.error("Error during rclone copy:", error);
    throw error; // Re-throw the error after logging
  } finally {
    // Clean up the temporary config directory and file
    try {
      await Deno.remove(tempDir, { recursive: true });
      console.debug(`Cleaned up temporary rclone config directory: ${tempDir}`);
    } catch (cleanupError) {
      console.error(`Failed to clean up temporary rclone config directory '${tempDir}':`, cleanupError);
      // Log the error but don't throw, as the primary operation might have succeeded/failed already
    }
  }
}
