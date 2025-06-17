import { signupForCommunityDay } from "./community-day";
import { addReaction, removeReaction } from "./reaction";
import { trackShareEvent } from "./share";
import { trackVideoEvent } from "./video";

export const server = {
	trackVideoEvent,
	signupForCommunityDay,
	trackShareEvent,
	addReaction,
	removeReaction,
};
