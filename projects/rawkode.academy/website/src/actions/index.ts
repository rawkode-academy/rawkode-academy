import { auth } from "./auth";
import { signupForCommunityDay } from "./community-day";
import { signupForCourseUpdates } from "./courses";
import { newsletter } from "./newsletter";
import { addReaction, removeReaction } from "./reaction";
import { trackShareEvent } from "./share";
import { technology } from "./technology";
import { trackVideoEvent } from "./video";

export const server = {
	auth,
	trackVideoEvent,
	signupForCommunityDay,
	signupForCourseUpdates,
	newsletter,
	technology,
	trackShareEvent,
	addReaction,
	removeReaction,
};
