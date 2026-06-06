import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { problems } from '$lib/server/db/schema';
import { requireUser } from '../../protected';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireUser(event);

	const [problem] = await db
		.select({
			slug: problems.slug,
			title: problems.title,
			promptMarkdown: problems.promptMarkdown,
			starterCode: problems.starterCode
		})
		.from(problems)
		.where(and(eq(problems.slug, event.params.slug), eq(problems.isPublished, true)))
		.limit(1);

	if (!problem) {
		error(404, 'Problem not found');
	}

	return { problem };
};
