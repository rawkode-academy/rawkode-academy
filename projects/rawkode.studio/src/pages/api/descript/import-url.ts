import type { APIRoute } from "astro";
import { DESCRIPT_API_TOKEN, DESCRIPT_PARTNER_DRIVE_ID, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } from "astro:env/server";
import { AwsClient } from "aws4fetch";

const DESCRIPT_ENDPOINT = "https://descriptapi.com/v1/edit_in_descript/schema";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as {
      sessionId: string;
      fileKeys?: string[]; // R2 object keys relative to bucket
      files?: { uri: string }[]; // pre-signed/public URIs (optional alternative)
    };
    const { sessionId } = body;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400 });
    }

    let files: { uri: string }[] | undefined = body.files;
    if (!files || files.length === 0) {
      const keys = body.fileKeys || [
        `sessions/${sessionId}/host/recording.mp4`,
      ];
      files = await buildUris(keys);
    }

    const schema = {
      partner_drive_id: DESCRIPT_PARTNER_DRIVE_ID,
      project_schema: {
        schema_version: "1.0.0",
        source_id: sessionId,
        files,
      },
    };

    const res = await fetch(DESCRIPT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${DESCRIPT_API_TOKEN}`,
      },
      body: JSON.stringify(schema),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "Descript error", status: res.status, body: t }), { status: 500 });
    }

    const json = await res.json();
    return new Response(JSON.stringify(json), { status: 201 });
  } catch (err) {
    console.error("descript.import-url error", err);
    return new Response(JSON.stringify({ error: "Failed to create import URL" }), { status: 500 });
  }
};

async function buildUris(keys: string[]): Promise<{ uri: string }[]> {
  const publicHost = (globalThis as any).process?.env?.R2_PUBLIC_HOST || (import.meta as any).env?.R2_PUBLIC_HOST;
  if (publicHost) {
    return keys.map((k) => ({ uri: `${publicHost}/${encodeURIComponent(k)}` }));
  }
  // Fallback: presign GET with query params (TTL depends on signer; for aws4fetch default is short)
  const aws = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  const out: { uri: string }[] = [];
  for (const k of keys) {
    const url = `${base}/${encodeURIComponent(k)}`;
    const signed = await aws.sign(new Request(url), { aws: { signQuery: true } });
    out.push({ uri: signed.url });
  }
  return out;
}

