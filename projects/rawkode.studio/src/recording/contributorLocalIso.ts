export const CONTRIBUTOR_LOCAL_ISO_DB = "rawkode-studio-contributor-local-iso-v1";
const DATABASE_VERSION = 1;
const RECORDINGS_STORE = "recordings";
const CHUNKS_STORE = "chunks";

export type ContributorLocalIsoStatus = "recording" | "complete" | "failed";

export interface ContributorLocalIsoManifest {
  id: string;
  sessionId: string;
  participantId: string;
  startedAt: string;
  stoppedAt?: string;
  mimeType: string;
  media: {
    audio: boolean;
    audioSettings: Pick<MediaTrackSettings, "channelCount" | "sampleRate">;
    video: boolean;
    videoSettings: Pick<MediaTrackSettings, "frameRate" | "height" | "width">;
  };
  status: ContributorLocalIsoStatus;
  failureReason?: string;
}

interface ContributorLocalIsoChunk {
  recordingId: string;
  sequence: number;
  blob: Blob;
}

export interface StartContributorLocalIsoOptions {
  mediaStream: MediaStream;
  participantId: string;
  sessionId: string;
}

export interface ContributorLocalIsoRecording {
  manifest: ContributorLocalIsoManifest;
  finished: Promise<ContributorLocalIsoManifest>;
  stop(): Promise<ContributorLocalIsoManifest>;
}

export function resolveContributorLocalIsoOutcome(
  trackEnded: boolean,
  writeFailed: boolean,
): ContributorLocalIsoStatus {
  return trackEnded || writeFailed ? "failed" : "complete";
}

export function createContributorLocalIsoManifest(
  options: StartContributorLocalIsoOptions,
  mimeType: string,
  id = createRecordingId(),
  startedAt = new Date().toISOString(),
): ContributorLocalIsoManifest {
  const audioTrack = options.mediaStream.getAudioTracks().find((track) => track.readyState === "live");
  const videoTrack = options.mediaStream.getVideoTracks().find((track) => track.readyState === "live");
  const audioSettings = audioTrack?.getSettings?.() ?? {};
  const videoSettings = videoTrack?.getSettings?.() ?? {};
  return {
    id,
    sessionId: options.sessionId,
    participantId: options.participantId,
    startedAt,
    mimeType,
    media: {
      audio: Boolean(audioTrack),
      audioSettings: {
        channelCount: audioSettings.channelCount,
        sampleRate: audioSettings.sampleRate,
      },
      video: Boolean(videoTrack),
      videoSettings: {
        frameRate: videoSettings.frameRate,
        height: videoSettings.height,
        width: videoSettings.width,
      },
    },
    status: "recording",
  };
}

export function getContributorLocalIsoMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

/** Stable across wrapper recreation; changes when the selected capture changes or is muted. */
export function getContributorLocalIsoMediaSignature(stream: MediaStream | null | undefined): string {
  return stream?.getTracks()
    .map((track) => `${track.kind}:${track.id}:${track.enabled}:${track.readyState}`)
    .sort()
    .join("|") ?? "";
}

/**
 * Starts a deliberately isolated, user-consented local recording. Each chunk is
 * written in a serialized, bounded queue. If storage falls behind, recording
 * stops as failed rather than retaining an unbounded list of blobs in memory.
 */
export async function startContributorLocalIsoRecording(
  options: StartContributorLocalIsoOptions,
): Promise<ContributorLocalIsoRecording> {
  const mimeType = getContributorLocalIsoMimeType();
  if (!mimeType) throw new Error("This browser cannot create a local WebM recording.");

  const tracks = cloneLiveTracks(options.mediaStream);
  if (tracks.length === 0) throw new Error("Connect a live camera or microphone before recording.");

  let store: ContributorLocalIsoStore | undefined;
  let persistedManifest: ContributorLocalIsoManifest | undefined;
  try {
    store = await ContributorLocalIsoStore.open();
    const recordingStore = store;
    const manifest = createContributorLocalIsoManifest(options, mimeType);
    persistedManifest = manifest;
    const cloneStream = new MediaStream(tracks);
    const videoSettings = tracks.find((track) => track.kind === "video")?.getSettings?.() ?? {};
    const recorder = new MediaRecorder(cloneStream, getRecordingOptions({
      fps: Math.round(videoSettings.frameRate ?? 30),
      height: Math.round(videoSettings.height ?? 720),
      width: Math.round(videoSettings.width ?? 1280),
    }, "high", mimeType));
    let appendQueue = Promise.resolve();
    let pendingWrites = 0;
    let nextSequence = 0;
    let stopping = false;
    let trackEnded = false;
    let writeFailed = false;
    let failureReason = "";
    let recorderStarted = false;
    let startupTrackEnded = false;
    let flushTimer: number | undefined;
    let finishPromise: Promise<ContributorLocalIsoManifest> | undefined;
    let resolveRecorderStopped: () => void;
    const recorderStopped = new Promise<void>((resolve) => {
      resolveRecorderStopped = resolve;
    });
    let resolveFinished: (manifest: ContributorLocalIsoManifest) => void;
    let rejectFinished: (error: unknown) => void;
    const finished = new Promise<ContributorLocalIsoManifest>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
    recorder.addEventListener("stop", () => resolveRecorderStopped!(), { once: true });

    const markFailure = (reason: string) => {
      if (!failureReason) failureReason = reason;
    };
    const finish = (): Promise<ContributorLocalIsoManifest> => {
      if (finishPromise) return finishPromise;
      stopping = true;
      if (flushTimer !== undefined) window.clearInterval(flushTimer);
      finishPromise = (async () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
        await recorderStopped;
        try {
          await appendQueue;
          tracks.forEach((track) => track.stop());
          const status = resolveContributorLocalIsoOutcome(trackEnded, writeFailed || Boolean(failureReason));
          const completed: ContributorLocalIsoManifest = {
            ...manifest,
            stoppedAt: new Date().toISOString(),
            status,
            ...(status === "failed" ? { failureReason: failureReason || "A media track ended early." } : {}),
          };
          await recordingStore.saveManifest(completed);
          return completed;
        } finally {
          recordingStore.close();
        }
      })();
      void finishPromise.then(resolveFinished!, rejectFinished!);
      return finishPromise;
    };
    const handleTrackEnded = () => {
      if (!stopping) {
        trackEnded = true;
        markFailure("A camera or microphone track ended before recording stopped.");
        if (recorderStarted) {
          void finish();
        } else {
          startupTrackEnded = true;
        }
      }
    };
    tracks.forEach((track) => track.addEventListener("ended", handleTrackEnded, { once: true }));

    await recordingStore.saveManifest(manifest);

    if (startupTrackEnded || tracks.some((track) => track.readyState !== "live")) {
      const failedManifest: ContributorLocalIsoManifest = {
        ...manifest,
        failureReason: "A camera or microphone track ended before local recording could start.",
        status: "failed",
        stoppedAt: new Date().toISOString(),
      };
      await recordingStore.saveManifest(failedManifest);
      recordingStore.close();
      persistedManifest = undefined;
      throw new Error(failedManifest.failureReason);
    }

    recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data.size === 0) return;
      if (pendingWrites >= 2) {
        writeFailed = true;
        markFailure("Local storage cannot keep up with this recording.");
        void finish();
        return;
      }
      const sequence = nextSequence;
      nextSequence += 1;
      pendingWrites += 1;
      appendQueue = appendQueue
        .then(() => recordingStore.appendChunk(manifest.id, sequence, event.data))
        .catch((error: unknown) => {
          writeFailed = true;
          markFailure(error instanceof Error ? error.message : "Local recording storage failed.");
          void finish();
        })
        .finally(() => {
          pendingWrites -= 1;
        });
    });
    recorder.addEventListener("error", () => {
      writeFailed = true;
      markFailure("The browser recorder stopped unexpectedly.");
      void finish();
    });

    recorder.start();
    recorderStarted = true;
    flushTimer = window.setInterval(() => {
      if (recorder.state === "recording") recorder.requestData();
    }, 1_000);

    return { manifest, finished, stop: finish };
  } catch (error) {
    tracks.forEach((track) => track.stop());
    if (store && persistedManifest) {
      await store.saveManifest({
        ...persistedManifest,
        failureReason: error instanceof Error ? error.message : "Unable to start local recording.",
        status: "failed",
        stoppedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
    store?.close();
    throw error;
  }
}

export class ContributorLocalIsoStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<ContributorLocalIsoStore> {
    const db = await requestToPromise(indexedDB.open(CONTRIBUTOR_LOCAL_ISO_DB, DATABASE_VERSION), (request) => {
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECORDINGS_STORE)) {
          database.createObjectStore(RECORDINGS_STORE, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunks = database.createObjectStore(CHUNKS_STORE, { keyPath: ["recordingId", "sequence"] });
          chunks.createIndex("by-recording", "recordingId", { unique: false });
        }
      };
    });
    return new ContributorLocalIsoStore(db);
  }

  async saveManifest(manifest: ContributorLocalIsoManifest): Promise<void> {
    await transactionToPromise(this.db.transaction(RECORDINGS_STORE, "readwrite"), (store) => store.put(manifest));
  }

  async appendChunk(recordingId: string, sequence: number, blob: Blob): Promise<void> {
    await transactionToPromise(this.db.transaction(CHUNKS_STORE, "readwrite"), (store) =>
      store.put({ recordingId, sequence, blob } satisfies ContributorLocalIsoChunk)
    );
  }

  async getManifest(id: string): Promise<ContributorLocalIsoManifest | undefined> {
    return await requestToPromise(this.db.transaction(RECORDINGS_STORE, "readonly").objectStore(RECORDINGS_STORE).get(id));
  }

  async listRecoverable(sessionId: string, participantId: string): Promise<ContributorLocalIsoManifest[]> {
    const all = await requestToPromise(this.db.transaction(RECORDINGS_STORE, "readonly").objectStore(RECORDINGS_STORE).getAll()) as ContributorLocalIsoManifest[];
    return all
      .filter((recording) => recording.sessionId === sessionId && recording.participantId === participantId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async readBlob(id: string): Promise<Blob | undefined> {
    const manifest = await this.getManifest(id);
    if (!manifest) return undefined;
    const chunks = await requestToPromise(
      this.db.transaction(CHUNKS_STORE, "readonly").objectStore(CHUNKS_STORE).index("by-recording").getAll(id),
    ) as ContributorLocalIsoChunk[];
    return new Blob(chunks.sort((left, right) => left.sequence - right.sequence).map((chunk) => chunk.blob), {
      type: manifest.mimeType,
    });
  }

  async discard(id: string): Promise<void> {
    const transaction = this.db.transaction([RECORDINGS_STORE, CHUNKS_STORE], "readwrite");
    transaction.objectStore(RECORDINGS_STORE).delete(id);
    const index = transaction.objectStore(CHUNKS_STORE).index("by-recording");
    const request = index.openKeyCursor(IDBKeyRange.only(id));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(CHUNKS_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionComplete(transaction);
  }

  close(): void {
    this.db.close();
  }
}

function cloneLiveTracks(stream: MediaStream): MediaStreamTrack[] {
  return stream.getTracks()
    .filter((track) => track.readyState === "live")
    .map((track) => track.clone());
}

function createRecordingId(): string {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `local-iso-${Date.now()}-${Math.random()}`;
}

function requestToPromise<T>(request: IDBRequest<T>, configure?: (request: IDBOpenDBRequest) => void): Promise<T> {
  configure?.(request as unknown as IDBOpenDBRequest);
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionToPromise(transaction: IDBTransaction, operation: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  operation(transaction.objectStore(transaction.objectStoreNames[0]!));
  return transactionComplete(transaction);
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}
import { getRecordingOptions } from "./quality";
