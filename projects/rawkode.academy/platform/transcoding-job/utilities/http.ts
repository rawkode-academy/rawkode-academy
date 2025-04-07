import { exists } from "@std/fs/exists";

export const downloadUrl = async (url: string, as: string): Promise<void> => {
  console.time(`downloadUrl ${as}`);

  // Check if the file already exists
  if (await exists(as)) {
    console.log(`File already exists locally: ${as}. Skipping download.`);
    console.timeEnd(`downloadUrl ${as}`);
    return;
  }

  console.log(`Downloading ${url} to ${as}...`);
  const fileResponse = await fetch(url);

  if (!fileResponse.ok) {
    console.error(
      `Failed to download ${url}: ${fileResponse.status} ${fileResponse.statusText}`,
    );
    console.timeEnd(`downloadUrl ${as}`);
    throw new Error(`Failed to download file: ${fileResponse.statusText}`);
  }

  if (fileResponse.body) {
    try {
      const file = await Deno.open(as, { write: true, create: true });
      await fileResponse.body.pipeTo(file.writable);
      console.log(`Successfully downloaded ${url} to ${as}`);
    } catch (error) {
      console.error(`Error writing file ${as}:`, error);
      // Attempt to clean up partially downloaded file
      try {
        await Deno.remove(as);
      } catch (removeError) {
        console.error(
          `Error removing partially downloaded file ${as}:`,
          removeError,
        );
      }
      throw error; // Re-throw the original error
    }
  } else {
    console.warn(`No response body received for ${url}`);
  }
  console.timeEnd(`downloadUrl ${as}`);
};
