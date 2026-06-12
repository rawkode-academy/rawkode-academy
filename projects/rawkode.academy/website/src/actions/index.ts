import { auth } from "./auth";
import { signupForCourseUpdates } from "./courses";
import { newsletter } from "./newsletter";
import { partnership } from "./partnership";
import { addReaction, removeReaction } from "./reaction";
import { trackShareEvent } from "./share";
import { streamNotifications } from "./stream-notifications";
import { trackVideoEvent } from "./video";
import { updateWatchPosition } from "./watch-history";

export const server = {
	auth,
	trackVideoEvent,
	signupForCourseUpdates,
	newsletter,
	partnership,
	trackShareEvent,
	streamNotifications,
	addReaction,
	removeReaction,
	updateWatchPosition,
};
