import { and, eq, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { oauthAccounts, sessions, users } from '$lib/server/db/schema';

const sessionCookieName = 'leetgame_session';
const sessionDays = 30;

type GitHubProfile = {
	id: number;
	email: string | null;
	name: string | null;
	avatar_url: string | null;
	login: string;
};

export type AuthUser = {
	id: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const sessionExpiresAt = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + sessionDays);
	return expiresAt;
};

export const createSession = async (cookies: Cookies, userId: string) => {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = sessionExpiresAt();

	await db.insert(sessions).values({
		userId,
		tokenHash: hashToken(token),
		expiresAt
	});

	cookies.set(sessionCookieName, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
};

export const clearSession = async (cookies: Cookies) => {
	const token = cookies.get(sessionCookieName);

	if (token) {
		await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
	}

	cookies.delete(sessionCookieName, { path: '/' });
};

export const getSessionUser = async (cookies: Cookies): Promise<AuthUser | null> => {
	const token = cookies.get(sessionCookieName);
	if (!token) return null;

	const [row] = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			avatarUrl: users.avatarUrl
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
		.limit(1);

	return row ?? null;
};

export const findOrCreateGitHubUser = async (profile: GitHubProfile) => {
	const provider = 'github';
	const providerAccountId = String(profile.id);
	const displayName = profile.name || profile.login;

	const [existingAccount] = await db
		.select({ userId: oauthAccounts.userId })
		.from(oauthAccounts)
		.where(
			and(
				eq(oauthAccounts.provider, provider),
				eq(oauthAccounts.providerAccountId, providerAccountId)
			)
		)
		.limit(1);

	if (existingAccount) {
		const [updatedUser] = await db
			.update(users)
			.set({
				email: profile.email,
				name: displayName,
				avatarUrl: profile.avatar_url,
				updatedAt: new Date()
			})
			.where(eq(users.id, existingAccount.userId))
			.returning();

		return updatedUser;
	}

	const [createdUser] = await db
		.insert(users)
		.values({
			email: profile.email,
			name: displayName,
			avatarUrl: profile.avatar_url
		})
		.returning();

	await db.insert(oauthAccounts).values({
		userId: createdUser.id,
		provider,
		providerAccountId
	});

	return createdUser;
};
