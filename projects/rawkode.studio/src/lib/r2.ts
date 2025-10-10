import { R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET, R2_SECRET_ACCESS_KEY } from "astro:env/server";
import { AwsClient } from "aws4fetch";

export function getR2AwsClient() {
  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return aws;
}

export function getR2EndpointBase(bucketOverride?: string) {
  const bucket = bucketOverride || R2_BUCKET;
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;
}

export function objectKeyFor(sessionId: string, trackId: string, ext: string) {
  return `sessions/${sessionId}/${trackId}/recording.${ext}`;
}

export function multipartInitUrlFor(key: string) {
  return `${getR2EndpointBase()}/${encodeURIComponent(key)}?uploads`;
}

export function multipartPartUrlFor(key: string, uploadId: string, partNumber: number) {
  return `${getR2EndpointBase()}/${encodeURIComponent(key)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
}

export function multipartCompleteUrlFor(key: string, uploadId: string) {
  return `${getR2EndpointBase()}/${encodeURIComponent(key)}?uploadId=${encodeURIComponent(uploadId)}`;
}

export function presignedGetUrlFor(key: string, expiresSeconds = 172800) { // 48h
  // aws4fetch signs with query params if we pass signQuery = true
  // The caller will use AwsClient.sign with signQuery option.
  return `${getR2EndpointBase()}/${encodeURIComponent(key)}`;
}

export function buildCompleteMultipartXml(parts: { PartNumber: number; ETag: string }[]) {
  const partsXml = parts
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map((p) => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>"${p.ETag}"</ETag></Part>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
}

export async function parseUploadIdFromInitiate(res: Response) {
  const text = await res.text();
  // Very small XML, parse with DOMParser available in Workers runtime
  try {
    // @ts-ignore Workers runtime has DOMParser
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const uploadId = doc.querySelector("UploadId")?.textContent || undefined;
    if (!uploadId) throw new Error("No UploadId in response");
    return uploadId;
  } catch (e) {
    throw new Error(`Failed to parse UploadId: ${text}`);
  }
}

