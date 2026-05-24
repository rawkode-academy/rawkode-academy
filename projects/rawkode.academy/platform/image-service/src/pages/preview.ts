import type { APIRoute } from "astro";
import { PayloadError, payloadFromSearchParams } from "@/lib/payload";
import { renderOpenGraphHtml } from "@/lib/render";

export const GET: APIRoute = ({ request }) => {
  try {
    const payload = payloadFromSearchParams(new URL(request.url).searchParams);

    return new Response(renderOpenGraphHtml(payload), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    if (error instanceof PayloadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
};
