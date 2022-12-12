import Surreal from "https://deno.land/x/surrealdb/mod.ts";
import { parse as parseYaml } from "https://deno.land/std@0.82.0/encoding/yaml.ts";

const surrealDb = new Surreal(
    Deno.env.get("SURREALDB_HOST") || "http://127.0.0.1:8000/rpc"
);
const surrealDbUser = Deno.env.get("SURREALDB_USER") || "root";
const surrealDbPass = Deno.env.get("SURREALDB_PASS") || "root";

const surrealDbNamespace = "rawkode";
const surrealDbDatabase = "data";

const dataDir = Deno.env.get("DATA_DIR") || "../../data";

const convertPerson = (person: any): any => {
    return {
        ...person,
        github: {
            handle: person.github,
        },
    };
};

async function main() {
    try {
        await surrealDb.signin({
            user: surrealDbUser,
            pass: surrealDbPass,
        });

        await surrealDb.query(`DEFINE NAMESPACE ${surrealDbNamespace}`);
        await surrealDb.query(
            `USE NAMESPACE ${surrealDbNamespace} ; DEFINE DATABASE ${surrealDbDatabase}`
        );
        await surrealDb.use(surrealDbNamespace, surrealDbDatabase);
    } catch (e) {
        console.error("Failed to connect to database: ", e);
        return;
    }

    const schema = await Deno.readTextFile("./schema.surql");

    await (
        await surrealDb.query(schema)
    ).forEach((result) => {
        if (result.error) {
            console.error("Failed to create schema: ", result.error);
            return;
        }
    });

    console.log("Schema Created");

    const dataTypes = ["people"];
    for (const dataType of dataTypes) {
        for (const dirEntry of Deno.readDirSync(`${dataDir}/${dataType}`)) {
            if (dirEntry.isFile && dirEntry.name.endsWith(".yaml")) {
                const data = parseYaml(
                    await Deno.readTextFile(
                        `${dataDir}/${dataType}/${dirEntry.name}`
                    )
                ) as Object;

                console.debug(convertPerson(data));

                const result = await surrealDb.create(
                    `${dataType}:${dirEntry.name.replace(".yaml", "")}`,
                    convertPerson(data)
                );

                console.debug(result);
            }
        }
    }

    surrealDb.close();
}

await main();
