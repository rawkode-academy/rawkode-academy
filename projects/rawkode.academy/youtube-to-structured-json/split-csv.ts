// Video ID,Approx Duration (ms),Video Audio Language,Video Category,Video Description (Original),Channel ID,Tag 1,Tag 2,Tag 3,Tag 4,Tag 5,Tag 6,Tag 7,Tag 8,Tag 9,Tag 10,Video Title (Original),Privacy,Video State,Video Create Timestamp,Video Publish Timestamp

import { join } from '@std/path';
import { parse } from '@std/csv';

const csv = Deno.readTextFileSync(join(import.meta.dirname!, '/data-from-youtube/videos.csv'));
const rows = await parse(csv, { skipFirstRow: false, trimLeadingSpace: true });

const headers = rows[0] as string[];

const videos = rows.slice(1).map(row => {
	const video: Record<string, string> = {};

	(row as string[]).forEach((value: string, index: number) => {
		video[headers[index]] = value;
	});

	return video;
});

videos.forEach((video, index) => {
	Deno.writeTextFileSync(join(import.meta.dirname!, `/data-from-csv/video-${index}.json`), JSON.stringify(video, null, 2));
});
