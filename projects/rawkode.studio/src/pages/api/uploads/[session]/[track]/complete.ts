import type { APIRoute } from "astro";
import { buildCompleteMultipartXml, getR2AwsClient, multipartCompleteUrlFor } from "@/lib/r2";

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const { uploadId, parts, key } = (await request.json()) as {
      uploadId: string;
      parts: { PartNumber: number; ETag: string }[];
      key: string;
    };
    if (!uploadId || !parts || parts.length === 0 || !key) {
      return new Response(JSON.stringify({ error: "Missing upload data" }), { status: 400 });
    }
    const aws = getR2AwsClient();
    const body = buildCompleteMultipartXml(parts);
    const req = new Request(multipartCompleteUrlFor(key, uploadId), {
      method: "POST",
      body,
      headers: { "content-type": "application/xml" },
    });
    const signed = await aws.sign(req);
    const res = await fetch(signed);
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "Complete failed", status: res.status, body: t }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("uploads.complete error", err);
    return new Response(JSON.stringify({ error: "Complete error" }), { status: 500 });
  }
};

