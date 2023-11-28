import { db } from "./migrate";
import { auth } from "./schema";

async function seed() {
	const seed = [
		{
			github: "rawkode",
			name: "David Flanagan",
			email: "example@example.com",
			token: "abc",
			refreshToken: "def",
		},
	];

	await db.insert(auth).values(seed).returning().all();

	process.exit(0);
}

seed();
