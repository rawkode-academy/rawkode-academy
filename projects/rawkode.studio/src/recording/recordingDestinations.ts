export interface RecordingDestinationSetupOptions<TBackup, TUpload> {
  createBackup(): Promise<TBackup>;
  createUpload(): Promise<TUpload | undefined>;
  shouldContinue?(): boolean;
}

export interface RecordingDestinationSetup<TBackup, TUpload> {
  backup: TBackup | undefined;
  cancelled: boolean;
  recoveryWarning: string;
  upload: TUpload | undefined;
  uploadWarning: string;
}

export async function initialiseRecordingDestinations<TBackup, TUpload>({
  createBackup,
  createUpload,
  shouldContinue = () => true,
}: RecordingDestinationSetupOptions<TBackup, TUpload>): Promise<
  RecordingDestinationSetup<TBackup, TUpload>
> {
  let backup: TBackup | undefined;
  let recoveryWarning = "";
  try {
    backup = await createBackup();
  } catch (error) {
    recoveryWarning = `Local crash recovery is unavailable: ${errorMessage(
      error,
      "Browser backup storage failed.",
    )} Server upload will continue.`;
  }

  if (!shouldContinue()) {
    return {
      backup,
      cancelled: true,
      recoveryWarning,
      upload: undefined,
      uploadWarning: "",
    };
  }

  let upload: TUpload | undefined;
  let uploadWarning = "";
  try {
    upload = await createUpload();
  } catch (error) {
    uploadWarning = errorMessage(error, "Server recording upload is unavailable.");
  }

  return {
    backup,
    cancelled: false,
    recoveryWarning,
    upload,
    uploadWarning,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
