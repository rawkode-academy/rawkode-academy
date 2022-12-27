import { existsSync, writeFile } from "fs";
import { default as fastGlob } from "fast-glob";
import { default as inquirer } from "inquirer";
import { load } from "js-yaml";
import { mkdir, readFile } from "fs/promises";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { slugify } from "../utils/mod.js";
import hcl from "hcl2-parser";

const dataBasePath = "../../../data/episodes";

interface Chapter {
    time: string;
    title: string;
}

interface Episode {
    title: string;
    show: string;
    publishedAt: Date;
    youtubeId: string;
    youtubeCategory: number;
    links: string[];
    chapters: Chapter[];
}

const loadEpisodesFromYaml = async () => {
    const yamlFiles = await fastGlob([`${dataBasePath}/**/*.yaml`], {
        dot: false,
    });

    const episodes: Episode[] = await Promise.all(
        yamlFiles.map(async (file) => {
            return load(await readFile(file, "utf8")) as Episode;
        }),
    );

    console.log("Found", episodes.length, "episodes");

    return episodes;
};

const loadEpisodesFromHcl = async () => {
    const hclFiles = await fastGlob(['output/episodes/**/*.hcl'], {
        dot: false,
    });

    const episodeLists: Episode[][] = await Promise.all(
        hclFiles.map(async (file) => {
            const hclContent = hcl.parseToObject(await readFile(file, 'utf8'))
            const hclEpisodes = hclContent[0]?.episode

            const episodes: Episode[] = []

            if (hclEpisodes !== undefined) {
                Object.entries(hclEpisodes).map((hclEpisode: any) => {
                    const title = hclEpisode[0] // episode title
                    const episode = hclEpisode[1]?.[0] // episode data

                    if (title !== undefined && episode !== undefined) {
                        episodes.push({
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
        }),
    );

    const episodes = episodeLists.flat()

    console.log("Found", episodes.length, "episodes");

    return episodes;
};

export const migrateYamlToHcl = async () => {
    const episodes = await loadEpisodesFromYaml();

    const hcl = episodes.map((episode) => {
        const hclContent = `episode "${escapeForHcl(episode.title)}" {
    show = "${escapeForHcl(episode.show)}"
    published_at = "${episode.publishedAt}"
    youtube_id = "${episode.youtubeId}"
    youtube_category = ${episode.youtubeCategory}
    links = [${episode.links.map((link) => `"${link}"`).join(", ")}]
    chapters = [${episode.chapters
                .map((chapter) => {
                    return `{ time = "${chapter.time
                        }", title = "${escapeForHcl(chapter.title)}" }`;
                })
                .join(", ")}]
}`;

        return [slugify(`${episode.show} ${episode.title}`), hclContent]
    });

    if (existsSync("output/episodes") === false) {
        console.log("Creating 'output' directory");
        await mkdir("output/episodes", { recursive: true });
    }

    hcl.forEach(([slug, content]) => {
        writeFile(`output/episodes/${slug}.hcl`, content, (err) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }
        })
    });

    console.log("Done writing HCL files");
};

export const migrateHclToSql = async () => {
    dayjs.extend(duration);

    const episodes = await loadEpisodesFromHcl();

    const insertStatements = episodes.map((episode) => {
        const id = slugify(`${episode.show} ${episode.title}`);

        const chapters = episode.chapters.map((chapter) => {
            const time = chapter.time.split(":");
            const title = escapeForSql(chapter.title);

            if (time.length === 2) {
                return `row('${dayjs
                    .duration({ minutes: +time[0], seconds: +time[1] })
                    .toISOString()}', '${title}')::chapter`;
            } else if (time.length === 3) {
                return `row('${dayjs
                    .duration({
                        hours: +time[0],
                        minutes: +time[1],
                        seconds: +time[2],
                    })
                    .toISOString()}', '${title}')::chapter`;
            }

            throw new Error(`Invalid time format: ${chapter.time}`);
        });

        const links = episode.links.map((link) => {
            return `'${link}'`;
        });

        const title = escapeForSql(episode.title);
        const show = escapeForSql(episode.show);
        const published_at = episode.publishedAt.toISOString();

        const linksArray =
            links.length > 0 ? `array[${links.join(", ")}]` : "array[]::text[]";
        const chaptersArray =
            chapters.length > 0
                ? `array[${chapters.join(", ")}]`
                : "array[]::chapter[]";

        return `INSERT INTO episodes ("id", "title", "showId", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters") VALUES ('${id}', '${title}', '${show}', '${published_at}', '${episode.youtubeId}', ${episode.youtubeCategory}, ${linksArray}, ${chaptersArray}) ON CONFLICT(id) DO NOTHING;`;
    });

    if (existsSync("output") === false) {
        console.log("Creating 'output' directory");
        await mkdir("output");
    }

    writeFile("output/episodes.sql", insertStatements.join("\n"), (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    });

    console.log("Done writing 'episodes.sql'!");
};

function escapeForSql(str: string) {
    return str.replace(/'/g, "''");
}

function escapeForHcl(str: string) {
    return str.replace(/"/g, '\\"');
}
