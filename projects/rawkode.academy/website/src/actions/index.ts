import { signupForCommunityDay } from "./community-day";
import { trackShareEvent } from "./share";
import { trackVideoEvent } from "./video";

export const server = {
	trackVideoEvent,
	signupForCommunityDay,
	trackShareEvent,
};
