import { Request as IttyRequest } from 'itty-router';
import * as jose from 'jose';
import { Env } from './types/env';
import { RequestWithIdentity } from './types/request';
import { KeyLike } from 'jose';

export interface RouteParams {
  projectName: string | undefined;
}

export function withParams(request: Request & RouteParams) {
  const { params } = request as IttyRequest;
  request.projectName = params?.projectName;
}

export async function withIdentity(request: Request & RequestWithIdentity, env: Env): Promise<Response | undefined> {
	const authorization = request.headers.get('Authorization');

	if (!authorization) {
		return new Response('Please include the correct authorization headers next time.', { status: 401 });
	}

	const [authScheme, token] = authorization.split(' ');
	if (authScheme.toLowerCase() !== 'basic') {
		return new Response(`Authentication type ${authScheme} is not supported for this endpoint.`, { status: 401 });
	}

	const [user, pass] = atob(token).split(':');

	if (user !== env.ACCESS_SUBDOMAIN || pass !== env.TOKEN) {
		return new Response('Authentication not valid.', { status: 401 });
	}

	request.identity = { userInfo: { username: "terraform" } };

	return undefined;
}
