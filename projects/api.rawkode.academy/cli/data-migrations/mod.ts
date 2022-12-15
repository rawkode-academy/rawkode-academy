import { writeFile } from "fs";
import { default as fastGlob } from "fast-glob";
import { default as inquirer } from "inquirer";
import { load } from "js-yaml";
import { readFile } from "fs/promises";
import knex, { Knex } from "knex";
import { Episodes } from "../../types.js";
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration.js'

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

export const migrate = async (db: Knex<any, unknown[]>) => {
    dayjs.extend(duration)

    await inquirer.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: "Are you sure you want to migrate data?",
        }
    ]);

    const yamlFiles = await fastGlob(['../../data/episodes/**/*.yaml'], { dot: false });

    const episodes: Episode[] = await Promise.all(yamlFiles.map(async (file) => {
        return load(await readFile(file, "utf8")) as Episode
    }));

    console.log("Found", episodes.length, "episodes");

    const insertStatements = episodes.map((episode) => {
        const chapters = episode.chapters.map((chapter) => {
            const time = chapter.time.split(":")
            const title = escape(chapter.title);

            if (time.length === 2) {
                return `row('${dayjs.duration({minutes: +time[0], seconds: +time[1]}).toISOString()}', '${title}')::chapter`
            } else if (time.length === 3) {
                return `row('${dayjs.duration({hours: +time[0], minutes: +time[1], seconds: +time[2]}).toISOString()}', '${title}')::chapter`
            }

            throw new Error("Invalid time format: " + chapter.time);
        });

        const links = episode.links.map((link) => {
            return `'${link}'`
        });

        const title = escape(episode.title);
        const show = escape(episode.show);

        const linksArray = links.length > 0 ? `array[${links.join(", ")}]` : "array[]::text[]";
        const chaptersArray = chapters.length > 0 ? `array[${chapters.join(", ")}]` : "array[]::chapter[]";

        return `INSERT INTO episodes ("title", "show", "scheduledFor", "youtubeId", "youtubeCategory", "links", "chapters") VALUES ('${title}', '${show}', '${episode.publishedAt}', '${episode.youtubeId}', ${episode.youtubeCategory}, ${linksArray}, ${chaptersArray}) ON CONFLICT(id) DO NOTHING;`;
    });

    writeFile("episodes.sql", insertStatements.join("\n"), (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    })

    console.log("Done writing 'episodes.sql'!");
}

function escape(str: string) {
    return str.replace(/'/g, "''");
}
