import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

export type TranscodeStatus = "complete" | "failed" | "running";

export interface TranscodeStatusContext {
  videoId: string;
  studioSessionId?: string | null;
  recordingId?: string | null;
  sourceBucket: string;
  sourceKey?: string | null;
  sourceEtag?: string | null;
  sourceFormat: string;
  outputPrefix: string;
}

export interface TranscodeStatusInput extends TranscodeStatusContext {
  status: TranscodeStatus;
  timestamp: string;
  error?: unknown;
}

export interface TranscodeStatusDocument extends TranscodeStatusContext {
  status: TranscodeStatus;
  completedAt?: string;
  failedAt?: string;
  startedAt?: string;
  error?: string;
}

export function getTranscodeStatusKey(outputPrefix: string): string {
  return `${
    outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`
  }transcode-status.json`;
}

export function serializeTranscodeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function buildTranscodeStatusDocument(
  input: TranscodeStatusInput,
): TranscodeStatusDocument {
  const document: TranscodeStatusDocument = {
    status: input.status,
    videoId: input.videoId,
    studioSessionId: input.studioSessionId,
    recordingId: input.recordingId,
    sourceBucket: input.sourceBucket,
    sourceKey: input.sourceKey,
    sourceEtag: input.sourceEtag,
    sourceFormat: input.sourceFormat,
    outputPrefix: input.outputPrefix,
  };

  if (input.status === "complete") {
    document.completedAt = input.timestamp;
  } else if (input.status === "failed") {
    document.failedAt = input.timestamp;
    document.error = serializeTranscodeError(input.error);
  } else {
    document.startedAt = input.timestamp;
  }

  return document;
}

export async function uploadTranscodeStatus(
  s3: S3Client,
  bucketName: string,
  input: TranscodeStatusInput,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      ACL: "public-read",
      Body: JSON.stringify(buildTranscodeStatusDocument(input), null, 2),
      Bucket: bucketName,
      ContentType: "application/json",
      Key: getTranscodeStatusKey(input.outputPrefix),
    }),
  );
}
