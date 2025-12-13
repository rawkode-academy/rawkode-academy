import { auth } from "./auth";
import { signupForCommunityDay } from "./community-day";
import { signupForCourseUpdates } from "./courses";
import { newsletter } from "./newsletter";
import { addReaction, removeReaction } from "./reaction";
import { search } from "./search";
import { trackShareEvent } from "./share";
import { trackVideoEvent } from "./video";

export const server = {
	auth,
	trackVideoEvent,
	signupForCommunityDay,
	signupForCourseUpdates,
	newsletter,
	trackShareEvent,
	addReaction,
	removeReaction,
	search,
};
