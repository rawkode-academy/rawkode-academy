import { zodToJsonSchema } from "zod-to-json-schema";
import { CreateTechnology as zod } from "./zod.ts";

export const CreateTechnology = zodToJsonSchema(zod, {
	name: "TechnologyCreate",
});
