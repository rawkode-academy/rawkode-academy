import { bracket } from "./bracket";
import { bracket as bracketActions } from "./bracket.ts";
import { newsletter } from "./newsletter.ts";

export const server = {
	bracket: bracketActions,
	newsletter,
};
