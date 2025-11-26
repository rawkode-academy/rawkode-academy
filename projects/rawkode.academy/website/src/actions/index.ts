import { auth } from "./auth";
import { signupForCommunityDay } from "./community-day";
import { signupForCourseUpdates } from "./courses";
import { addReaction, removeReaction } from "./reaction";
import { trackShareEvent } from "./share";
import { trackVideoEvent } from "./video";

export const server = {
	auth,
	trackVideoEvent,
	signupForCommunityDay,
	signupForCourseUpdates,
	trackShareEvent,
	addReaction,
	removeReaction,
};
