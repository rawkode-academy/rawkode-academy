import type { APIRoute } from "astro";
// import { getSessionFromCookie } from "../../utils/sessionCookie";

export const prerender = false;

export const GET: APIRoute = async ({ }) => {
	// const { getSecret } = await import("astro:env/server");

	// const session = await getSessionFromCookie(cookies);

	// We can't use cookies.delete, because
	// the cookies are lost the moment we call `redirect`.
	// They're only applied to standard responses via Astro
	// pages
	// if (!("accessToken" in session)) {
	return new Response(null, {
		status: 307,
		headers: {
			Location: '/',
			'Set-Cookie': 'wos-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		},
	});
	// }

	// Failing because of CORS on api.workos.com
	// const workos = new WorkOS(getSecret("WORKOS_API_KEY"));
	// const sessionId = decodeJwt(session.accessToken).sid as string;

	// return new Response(null, {
	// 	status: 307,
	// 	headers: {
	// 		Location: workos.userManagement.getLogoutUrl({
	// 			sessionId
	// 		}),
	// 		'mode': 'no-cors',
	// 		"Referrer Policy": "strict-origin-when-cross-origin",
	// 		'Set-Cookie': 'wos-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
	// 	},
	// });
};
