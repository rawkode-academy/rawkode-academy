import type SchemaBuilder from "@pothos/core";
import type { VideoItem } from "../loaders/videos";
import type { ShowItem } from "../loaders/shows";
import type { PersonItem, PersonLink } from "../loaders/people";
import type { TechnologyItem } from "../loaders/technologies";
import { listVideos } from "../loaders/videos";
import { listShows } from "../loaders/shows";
import { getPersonById } from "../loaders/people";
import { getTechnologyById } from "../loaders/technologies";

export function registerRelationships(
	builder: InstanceType<typeof SchemaBuilder<{}>>,
	refs: {
		VideoRef: ReturnType<typeof builder.objectRef<VideoItem>>;
		ShowRef: ReturnType<typeof builder.objectRef<ShowItem>>;
		PersonRef: ReturnType<typeof builder.objectRef<PersonItem>>;
		TechnologyRef: ReturnType<typeof builder.objectRef<TechnologyItem>>;
	},
) {
	const { VideoRef, ShowRef, PersonRef, TechnologyRef } = refs;

	const PersonLinkRef = builder.objectRef<PersonLink>("PersonLink");
	builder.objectType(PersonLinkRef, {
		fields: (t: any) => ({
			url: t.exposeString("url"),
			name: t.exposeString("name"),
		}),
	});

	builder.objectField(VideoRef, "technologies", (t: any) =>
		t.field({
			type: [TechnologyRef],
			resolve: async (video: VideoItem) => {
				const techIds = video.technologies ?? [];
				const techs = await Promise.all(
					techIds.map((id) => {
						const normalizedId = id.endsWith("/index")
							? id
							: `${id}/index`;
						return getTechnologyById(normalizedId);
					}),
				);
				return techs.filter(
					(t): t is NonNullable<typeof t> => t !== null,
				);
			},
		}),
	);

	builder.objectField(VideoRef, "guests", (t: any) =>
		t.field({
			type: [PersonRef],
			resolve: async (video: VideoItem) => {
				const guestIds = video.guests ?? [];
				const guests = await Promise.all(
					guestIds.map((id) => getPersonById(id)),
				);
				return guests.filter(
					(g): g is NonNullable<typeof g> => g !== null,
				);
			},
		}),
	);

	builder.objectField(ShowRef, "hosts", (t: any) =>
		t.field({
			type: [PersonRef],
			resolve: async (show: ShowItem) => {
				const hostIds = show.hosts ?? [];
				const hosts = await Promise.all(
					hostIds.map((id) => getPersonById(id)),
				);
				return hosts.filter(
					(h): h is NonNullable<typeof h> => h !== null,
				);
			},
		}),
	);

	builder.objectField(PersonRef, "biography", (t: any) =>
		t.field({
			type: "String",
			nullable: true,
			resolve: (person: PersonItem) => person.biography ?? null,
		}),
	);

	builder.objectField(PersonRef, "links", (t: any) =>
		t.field({
			type: [PersonLinkRef],
			resolve: (person: PersonItem) => person.links ?? [],
		}),
	);

	builder.objectField(TechnologyRef, "videos", (t: any) =>
		t.field({
			type: [VideoRef],
			resolve: async (tech: TechnologyItem) => {
				const videos = await listVideos();
				const now = new Date();
				return videos.filter(
					(v) =>
						v.publishedAt <= now &&
						v.technologies.some((t) => {
							const normalizedTechId = t.endsWith("/index")
								? t
								: `${t}/index`;
							return normalizedTechId === tech.id;
						}),
				);
			},
		}),
	);

	builder.objectField(PersonRef, "guestAppearances", (t: any) =>
		t.field({
			type: [VideoRef],
			resolve: async (person: PersonItem) => {
				const videos = await listVideos();
				const now = new Date();
				return videos.filter(
					(v) =>
						v.publishedAt <= now && v.guests.includes(person.id),
				);
			},
		}),
	);

	builder.objectField(PersonRef, "hostedShows", (t: any) =>
		t.field({
			type: [ShowRef],
			resolve: async (person: PersonItem) => {
				const shows = await listShows();
				return shows.filter((s) => s.hosts.includes(person.id));
			},
		}),
	);

	return { PersonLinkRef };
}
