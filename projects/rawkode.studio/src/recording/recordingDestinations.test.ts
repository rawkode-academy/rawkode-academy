import { describe, expect, it, vi } from "vitest";
import { initialiseRecordingDestinations } from "./recordingDestinations";

describe("recording destination setup", () => {
  it("continues server multipart upload setup when IndexedDB backup creation fails", async () => {
    const serverUpload = { uploadId: "multipart-upload" };
    const createUpload = vi.fn(async () => serverUpload);

    const result = await initialiseRecordingDestinations({
      createBackup: async () => {
        throw new Error("IndexedDB is unavailable.");
      },
      createUpload,
    });

    expect(createUpload).toHaveBeenCalledOnce();
    expect(result).toEqual({
      backup: undefined,
      cancelled: false,
      recoveryWarning:
        "Local crash recovery is unavailable: IndexedDB is unavailable. Server upload will continue.",
      upload: serverUpload,
      uploadWarning: "",
    });
  });

  it("does not start an upload after the component has been torn down", async () => {
    const createUpload = vi.fn(async () => ({ uploadId: "unused" }));

    const result = await initialiseRecordingDestinations({
      createBackup: async () => ({ id: "local-backup" }),
      createUpload,
      shouldContinue: () => false,
    });

    expect(createUpload).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(true);
    expect(result.backup).toEqual({ id: "local-backup" });
  });
});
