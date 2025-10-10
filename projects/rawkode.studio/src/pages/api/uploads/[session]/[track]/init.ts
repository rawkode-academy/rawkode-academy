import type { APIRoute } from "astro";
import { getR2AwsClient, multipartInitUrlFor, objectKeyFor, parseUploadIdFromInitiate } from "@/lib/r2";

export const POST: APIRoute = async ({ params }) => {
  try {
    const sessionId = params.session as string;
    const trackId = params.track as string;
    if (!sessionId || !trackId) {
      return new Response(JSON.stringify({ error: "Missing session or track" }), { status: 400 });
    }

    const key = objectKeyFor(sessionId, trackId, "mp4");
    const aws = getR2AwsClient();
    const initUrl = multipartInitUrlFor(key);
    const signed = await aws.sign(new Request(initUrl, { method: "POST" }));
    const res = await fetch(signed);
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "R2 init failed", status: res.status, body: t }), { status: 500 });
    }
    const uploadId = await parseUploadIdFromInitiate(res);
    return new Response(JSON.stringify({ uploadId, key }), { status: 200 });
  } catch (err) {
    console.error("uploads.init error", err);
    return new Response(JSON.stringify({ error: "Init error" }), { status: 500 });
  }
};

