import type { APIRoute } from "astro";
import { getR2AwsClient, multipartPartUrlFor } from "@/lib/r2";

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const sessionId = params.session as string;
    const trackId = params.track as string;
    const uploadId = url.searchParams.get("uploadId");
    const partNumberStr = url.searchParams.get("partNumber");
    const key = url.searchParams.get("key") || `sessions/${sessionId}/${trackId}/recording.mp4`;
    if (!sessionId || !trackId || !uploadId || !partNumberStr) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });
    }
    const partNumber = Number.parseInt(partNumberStr, 10);
    const aws = getR2AwsClient();
    const partUrl = multipartPartUrlFor(key, uploadId, partNumber);
    const req = new Request(partUrl, { method: "PUT" });
    const signed = await aws.sign(req, { aws: { allHeaders: true, signQuery: false } });
    // Return raw URL and the minimal headers required for the browser PUT
    const headers: Record<string, string> = {};
    const allow = ["authorization", "x-amz-content-sha256", "x-amz-date", "host"];
    for (const [k, v] of signed.headers.entries()) {
      if (allow.includes(k.toLowerCase())) headers[k] = v as string;
    }
    return new Response(JSON.stringify({ url: signed.url, headers, key }), { status: 200 });
  } catch (err) {
    console.error("uploads.part error", err);
    return new Response(JSON.stringify({ error: "Part sign error" }), { status: 500 });
  }
};

