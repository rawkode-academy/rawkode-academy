import { auth } from "./auth";
import { signupForCommunityDay } from "./community-day";
import { signupForCourseUpdates } from "./courses";
import { email } from "./email";
import { newsletter } from "./newsletter";
import { addReaction, removeReaction } from "./reaction";
import { trackShareEvent } from "./share";
import { trackVideoEvent } from "./video";

export const server = {
	auth,
	trackVideoEvent,
	signupForCommunityDay,
	signupForCourseUpdates,
	newsletter,
	email,
	trackShareEvent,
	addReaction,
	removeReaction,
};
