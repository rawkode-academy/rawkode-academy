import {
	type Context,
	endpoint,
	service,
	TerminalError,
} from '@restatedev/restate-sdk/fetch';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../data-model/client.ts';
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

// We allow this to be empty because of how deno deploy works
const restateIdentityKey = Deno.env.get('RESTATE_IDENTITY_KEY') || '';

// and because of ^^ we set a fake key for the "first" deploy
// YES, THIS SUCKS.
const handler = endpoint().bind(episodeService).withIdentityV1(
	restateIdentityKey ||
		'publickeyv1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
).bidirectional().handler();

const port = Deno.env.get('PORT') || '9080';

Deno.serve({
	port: Number(port),
	onListen: ({ hostname, port, transport }) => {
		console.log(`Listening on ${transport}://${hostname}:${port}`);
	},
}, handler.fetch);
