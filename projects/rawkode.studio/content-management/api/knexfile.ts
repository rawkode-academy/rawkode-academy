import { Knex } from "knex";

export const config: Knex.Config = {
	client: "pg",
	connection: process.env.DATABASE_DSN!,
};
