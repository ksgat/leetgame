import { env } from '$env/dynamic/private';
import { createSession, findOrCreateGitHubUser } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const stateCookieName = 'leetgame_oauth_state';

type GitHubEmail = {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
};

export const GET: RequestHandler = async ({ cookies, fetch, url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(stateCookieName);

	cookies.delete(stateCookieName, { path: '/' });

	if (!code || !state || !expectedState || state !== expectedState) {
		error(400, 'Invalid GitHub sign-in state');
	}

	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		error(500, 'GitHub OAuth env vars are not configured');
	}

	const callbackUrl = new URL('/auth/github/callback', env.AUTH_BASE_URL || url.origin);
	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: callbackUrl.toString()
		})
	});

	const tokenPayload = await tokenResponse.json();
	const accessToken = tokenPayload.access_token as string | undefined;

	if (!tokenResponse.ok || !accessToken) {
		error(400, 'Could not exchange GitHub authorization code');
	}

	const profileResponse = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/vnd.github+json'
		}
	});

	if (!profileResponse.ok) {
		error(400, 'Could not read GitHub profile');
	}

	const profile = await profileResponse.json();

	if (!profile.email) {
		const emailsResponse = await fetch('https://api.github.com/user/emails', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github+json'
			}
		});

		if (emailsResponse.ok) {
			const emails = (await emailsResponse.json()) as GitHubEmail[];
			const primaryEmail = emails.find((email) => email.primary && email.verified);
			profile.email = primaryEmail?.email ?? null;
		}
	}

	const user = await findOrCreateGitHubUser(profile);
	await createSession(cookies, user.id);

	redirect(302, '/problems');
};
