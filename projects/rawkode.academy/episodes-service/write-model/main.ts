import { createClient } from '@libsql/client';
import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from '@restatedev/restate-sdk/fetch';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { z } from 'zod';
import { CreateEpisode } from '../data-model/integrations/zod.ts';
import { episodesTable } from '../data-model/schema.ts';

// This avoids using polyfilled node APIs
Deno.env.set('USE_WEB_CRYPTO', 'true');

type T = z.infer<typeof CreateEpisode>;

const episodeService = service({
	name: 'person',
	handlers: {
		create: async (ctx: Context, episode: T) => {
			try {
				CreateEpisode.parse(episode);
			} catch (e) {
				return {
					message: 'Failed to create Episode.',
					error: e,
				};
			}

			const client = createClient({
				url: Deno.env.get('LIBSQL_URL')!,
				authToken: Deno.env.get('LIBSQL_TOKEN')!,
			});

			const db = drizzle(client);

			ctx.console.log(
				'Checking unique constraints are passing before writing to database',
			);

			const checks = await db.select().from(episodesTable).where(
				and(
					eq(episodesTable.code, episode.code),
					eq(episodesTable.showId, episode.showId),
				),
			);

			if (checks.length > 0) {
				throw new TerminalError(
					`New person, ${episode.code}, does not pass unique ID constraints for show ${episode.showId}.`,
					{ errorCode: 400 },
				);
			}

			await db
				.insert(episodesTable)
				.values(episode)
				.run();

			return 'Job done';
		},
	},
});

const handler = endpoint().bind(episodeService).withIdentityV1(
	Deno.env.get('RESTATE_IDENTITY_KEY')!,
).bidirectional().handler();

Deno.serve({ port: 9080 }, handler.fetch);
