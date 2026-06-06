import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import type { RequestHandler } from './$types';

const stateCookieName = 'leetgame_oauth_state';

export const GET: RequestHandler = ({ cookies, url }) => {
	if (!env.GITHUB_CLIENT_ID) {
		error(500, 'GITHUB_CLIENT_ID is not set');
	}

	const state = randomBytes(24).toString('base64url');
	const callbackUrl = new URL('/auth/github/callback', env.AUTH_BASE_URL || url.origin);
	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');

	authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
	authorizeUrl.searchParams.set('scope', 'read:user user:email');
	authorizeUrl.searchParams.set('state', state);

	cookies.set(stateCookieName, state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 10
	});

	redirect(302, authorizeUrl.toString());
};
