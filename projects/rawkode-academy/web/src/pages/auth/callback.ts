import { WorkOS } from '@workos-inc/node';
import type { APIRoute } from 'astro';
import { getSecret } from "astro:env/server";
import { sealData } from 'iron-session';

export const prerender = false;

export const GET: APIRoute = async ({
  request,
  redirect,
  cookies,
}) => {
	const workos = new WorkOS(getSecret("WORKOS_API_KEY"));

  const code = String(
    new URL(request.url).searchParams.get('code')
  )
  const session =
    await workos.userManagement.authenticateWithCode({
      code,
			clientId: getSecret("WORKOS_CLIENT_ID") || "",
    })

  const encryptedSession = await sealData(session, {
    password: getSecret("WORKOS_COOKIE_PASSWORD") || "",
  })

  cookies.set('wos-session', encryptedSession, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  })

  return redirect('/')
}
