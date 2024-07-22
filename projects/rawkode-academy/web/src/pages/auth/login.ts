import { WorkOS } from "@workos-inc/node";
import type { APIRoute } from 'astro';

export const prerender = false;

const workos = new WorkOS(import.meta.env.WORKOS_API_KEY);
const clientId = import.meta.env.WORKOS_CLIENT_ID || "";

export const GET: APIRoute = async ({ redirect }) => {
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
        provider: 'authkit',
        redirectUri: 'http://localhost:4321/auth/callback',
        clientId,
      });
    

      return redirect(authorizationUrl);
}
