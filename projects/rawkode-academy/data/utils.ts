import { readdirSync } from "fs";

export const loader = async <T>(dir: string): Promise<T[]> => {
	const files = await readdirSync(dir);
	return Promise.all(
		files
			.filter((file) => file.endsWith(".ts") && file !== "index.ts")
			.map(async (file) => {
				const module = await import(`./${dir}/${file}`);
				return module.default as T;
			}),
	);
};
