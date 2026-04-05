import type { APIRoute } from "astro";
import { fetchLinkPreview } from "@/lib/server/link-preview";
import { asRequestError } from "@/lib/server/errors";

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get("url") ?? "";

  try {
    const preview = await fetchLinkPreview(targetUrl);
    return Response.json(preview, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const requestError = asRequestError(error);
    return Response.json(
      { error: requestError.message },
      {
        status: requestError.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
};
