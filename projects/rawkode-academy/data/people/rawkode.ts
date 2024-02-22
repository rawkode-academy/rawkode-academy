import { Person } from ".";

const biography = `
I am Rawkode!
`;

export default new Person("rawkode", "David Flanagan")
	.addBiography(biography)
	.addBlueSky("rawkode.dev")
	.addDiscord("rawkode")
	.addLinkedIn("rawkode")
	.addMastodon("david@rawkode.academy")
	.addX("rawkode")
	.addYouTube("RawkodeAcademy");
