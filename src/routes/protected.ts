import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const requireUser = (event: RequestEvent) => {
	if (!event.locals.user) {
		const next = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/auth?next=${encodeURIComponent(next)}`);
	}

	return event.locals.user;
};
