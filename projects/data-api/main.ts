import Surreal from "https://deno.land/x/surrealdb/mod.ts";

const db = new Surreal("http://127.0.0.1:8000/rpc");

async function main() {
    try {
        await db.signin({
            user: "root",
            pass: "root",
        });

        await db.use("rawkode.academy", "data");

        console.log("Done");
        // let created = await db.create("person", {
        //   title: "Founder & CEO",
        //   name: {
        //     first: "Tobie",
        //     last: "Morgan Hitchcock",
        //   },
        //   marketing: true,
        //   identifier: Math.random().toString(36).substr(2, 10),
        // });

        // // Update a person record with a specific id
        // let updated = await db.change("person:jaime", {
        //   marketing: true,
        // });

        // // Select all people records
        // let people = await db.select("person");

        // // Perform a custom advanced query
        // let groups = await db.query(
        //   "SELECT marketing, count() FROM type::table($tb) GROUP BY marketing",
        //   {
        //     tb: "person",
        //   }
        // );
    } catch (e) {
        console.error("Failed to connect to database: ", e);
    } finally {
        db.close();
    }
}

await main();
