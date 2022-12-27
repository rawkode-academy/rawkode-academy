import { existsSync, writeFile } from "fs";
import { default as fastGlob } from "fast-glob";
import { default as inquirer } from "inquirer";
import { load } from "js-yaml";
import { mkdir, readFile } from "fs/promises";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { slugify } from "../utils/mod.js";

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

const loadEpisodes = async () => {
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

export const migrateYamlToHcl = async () => {
    const episodes = await loadEpisodes();

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
        await mkdir("output/episodes");
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

export const migrate = async () => {
    dayjs.extend(duration);

    await inquirer.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: "Are you sure you want to migrate data?",
        },
    ]);

    const episodes = await loadEpisodes();

    const insertStatements = episodes.map((episode) => {
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

        const linksArray =
            links.length > 0 ? `array[${links.join(", ")}]` : "array[]::text[]";
        const chaptersArray =
            chapters.length > 0
                ? `array[${chapters.join(", ")}]`
                : "array[]::chapter[]";

        return `INSERT INTO episodes ("title", "showId", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters") VALUES ('${title}', '${show}', '${episode.publishedAt}', '${episode.youtubeId}', ${episode.youtubeCategory}, ${linksArray}, ${chaptersArray}) ON CONFLICT(id) DO NOTHING;`;
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
