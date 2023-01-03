import { existsSync, writeFile } from "fs";
import { default as fastGlob } from "fast-glob";
import { default as inquirer } from "inquirer";
import { load } from "js-yaml";
import { mkdir, readFile } from "fs/promises";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { slugify } from "../utils/mod.js";
import hcl from "hcl2-parser";
import { Episode, Person, Show, Syncable, Technology } from "./types.js";

const dataBasePath = "../content-management"

const unmarshalEpisode = (hclContent: any): Episode[] => {
    const hclEpisodes = hclContent[0]?.episode

    const episodes: Episode[] = []

    if (hclEpisodes !== undefined) {
        Object.entries(hclEpisodes).map((hclEpisode: any) => {
            const title = hclEpisode[0] // episode title
            const episode = hclEpisode[1]?.[0] // episode data

            if (title !== undefined && episode !== undefined) {
                episodes.push({
                    type: "episode",
                    title: title,
                    show: episode.show,
                    publishedAt: new Date(episode.published_at),
                    youtubeId: episode.youtube_id,
                    youtubeCategory: episode.youtube_category,
                    links: episode.links,
                    chapters: episode.chapters,
                });
            }
        })
    }

    return episodes;
}

const unmarshalPerson = (hclContent: any): Person[] => {
    const hclPeople = hclContent[0]?.person

    const people: Person[] = []

    if (hclPeople !== undefined) {
        Object.entries(hclPeople).map((hclPerson: any) => {
            const title = hclPerson[0]
            const person = hclPerson[1]?.[0]

            if (title !== undefined && person !== undefined) {
                people.push({
                    type: "person",
                    id: title,
                    name: person.name,
                    twitter: person.twitter,
                    github: person.github,
                    youtube: person.youtube,
                });
            }
        })
    }

    return people;
}

const unmarshalTechnology = (hclContent: any): Technology[] => {
    const hclTechnology = hclContent[0]?.technology

    const technologies: Technology[] = []

    if (hclTechnology !== undefined) {
        Object.entries(hclTechnology).map((hclTechnology: any) => {
            const title = hclTechnology[0]
            const technology = hclTechnology[1]?.[0]

            if (title !== undefined && technology !== undefined) {
                technologies.push({
                    type: "technology",
                    title: title,
                    website: technology.website,
                    documentation: technology.documentation,
                    repository: technology.repository,
                    description: technology.description,
                });
            }
        })
    }

    return technologies;
}

const unmarshalShow = (hclContent: any): Show[] => {
    const hclShow = hclContent[0]?.show

    const shows: Show[] = []

    if (hclShow !== undefined) {
        Object.entries(hclShow).map((hclShow: any) => {
            const title = hclShow[0]
            const show = hclShow[1]?.[0]

            if (title !== undefined && show !== undefined) {
                shows.push({
                    type: "show",
                    title: slugify(title),
                });
            }
        })
    }

    return shows;
}

export const sync = async () => {
    const hclFiles = await fastGlob([`${dataBasePath}/**/*.hcl`], {
        dot: false,
    });

    const syncables: (Syncable | undefined)[] = (await Promise.all(hclFiles.map(async (file) => {
        const hclContent = hcl.parseToObject(await readFile(file, "utf8"))

        if (file.includes('/episodes/')) {
            return unmarshalEpisode(hclContent)
        } else if (file.includes('/people/')) {
            return unmarshalPerson(hclContent)
        } else if (file.includes('/technologies/')) {
            return unmarshalTechnology(hclContent)
        } else if (file.includes('/shows/')) {
            return unmarshalShow(hclContent)
        }

        return undefined
    }))).flat();

    const sqlStatements = syncables.map((syncable) => {
        switch (syncable?.type) {
            case "episode": return episodeToSql(syncable as Episode)
            case "show": return showToSql(syncable as Show);
            case "person": return personToSql(syncable as Person);
            case "technology": return technologyToSql(syncable as Technology);
            default:
                console.log(`Cannot create SQL statement for syncable of type ${JSON.stringify(syncable)}}`)
                break
        }
    });

    // TODO: do something useful with the SQL statements

    console.log(`Created ${sqlStatements.length} SQL statements for ${syncables.length} syncables`);
}

const technologyToSql = (technology: Technology): string => {
    // TODO: add openSource, twitterHandle and youtubeHandle to Technology interface
    return `
INSERT INTO technologies ("id", "name", "description", "website", "repository", "documentation")
VALUES (
    '${slugify(technology.title)}',
    '${technology.title}',
    '${technology.description}',
    '${technology.website}',
    '${technology.repository}',
    '${technology.documentation}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = '${technology.title}',
    "description" = '${technology.description}',
    "website" = '${technology.website}',
    "repository" = '${technology.repository}',
    "documentation" = '${technology.documentation}';
`;
}

const personToSql = (person: Person): string => {
    // TODO: add email and biography to Person interface
    // TODO: make github handle mandatory in Person interface
    return `
INSERT INTO people ("id", "name", "githubHandle", "twitterHandle", "youtubeHandle")
VALUES (
    '${person.id}',
    '${person.name}',
    '${person.github || "<no handle defined>"}',
    '${person.twitter || "<no handle defined>"}',
    '${person.youtube || "<no handle defined>"}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = '${person.name}',
    "githubHandle" = '${person.github || "<no handle defined>"}',
    "twitterHandle" = '${person.twitter || "<no handle defined>"}',
    "youtubeHandle" = '${person.youtube || "<no handle defined>"}';
`;
}

const showToSql = (show: Show): string => {
    return `
INSERT INTO shows ("id", "title")
VALUES (
    '${slugify(show.title)}',
    '${show.title}'
)
ON CONFLICT ("id") DO UPDATE
SET
    "title" = '${show.title}';
`;
}

const episodeToSql = (episode: Episode): string => {
    dayjs.extend(duration);

    const linksArray = episode.links.length > 0 ? `array[${episode.links.join(", ")}]` : "array[]::text[]";

    const chapters = episode.chapters.map((chapter) => {
        const time = chapter.time.split(":");
        const title = chapter.title;

        if (time.length === 3) {
            return `row('${dayjs
                .duration({
                    hours: +time[0],
                    minutes: +time[1],
                    seconds: +time[2],
                })
                .toISOString()}', '${title}')::chapter`;
        }

        throw new Error(`Invalid time format: ${time}`);
    })

    const chaptersArray =
        chapters.length > 0
            ? `array[${chapters.join(", ")}]`
            : "array[]::chapter[]";

    return `
INSERT INTO episodes ("id", "title", "showId", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters")
VALUES (
    '${slugify(`${episode.show} ${episode.title}`)}',
    '${episode.title}',
    '${episode.show}',
    '${episode.publishedAt.toISOString()}',
    '${episode.youtubeId}',
    ${episode.youtubeCategory},
    ${linksArray},
    ${chaptersArray}
)
ON CONFLICT ("id") DO UPDATE
SET
    "title" = '${episode.title}',
    "showId" = '${episode.show}',
    "scheduledFor" = '${episode.publishedAt.toISOString()}',
    "youtubeId" = '${episode.youtubeId}',
    "youtubeCategory" = ${episode.youtubeCategory},
    "links" = ${linksArray},
    "chapters" = ${chaptersArray};
`;
}
