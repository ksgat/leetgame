import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { problems } from '$lib/server/db/schema';
import { requireUser } from '../protected';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const problemRows = await db
		.select({
			id: problems.id,
			slug: problems.slug,
			title: problems.title,
			createdAt: problems.createdAt
		})
		.from(problems)
		.where(eq(problems.isPublished, true))
		.orderBy(asc(problems.createdAt));

	return { user, problems: problemRows };
};
