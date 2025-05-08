import { webhookReceiver } from "@/lib/livekit";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await webhookReceiver.receive(body, authorization);

  console.log(event);

  return new Response("OK", { status: 200 });
};
