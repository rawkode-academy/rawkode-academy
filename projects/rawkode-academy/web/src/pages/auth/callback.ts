import { WorkOS } from '@workos-inc/node';
import type { APIRoute } from 'astro';
import { sealData } from 'iron-session';

export const prerender = false;

export const GET: APIRoute = async ({
	locals,
  request,
  redirect,
  cookies,
}) => {
	const env = locals.runtime.env;
	const workos = new WorkOS(env.WORKOS_API_KEY)

  const code = String(
    new URL(request.url).searchParams.get('code')
  )
  const session =
    await workos.userManagement.authenticateWithCode({
      code,
      clientId: env.WORKOS_CLIENT_ID,
    })

  const encryptedSession = await sealData(session, {
    password: env.WORKOS_COOKIE_PASSWORD,
  })

  cookies.set('wos-session', encryptedSession, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  })

  return redirect('/')
}
