import { loader } from "../utils";

export const loadPeople = async () => loader<Person>("people");

export class Person {
	public readonly id: string;
	public readonly name;
	protected biography = '';
	protected socialAccounts: SocialAccounts = {};

	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
	}

	addBiography(biography: string): Person {
		this.biography = biography.trimStart().trimEnd();
		return this;
	}

	addBlueSky(handle: string): Person {
		this.socialAccounts.blueSky = { handle };
		return this;
	}

	addDiscord(handle: string): Person {
		this.socialAccounts.discord = { handle };
		return this;
	}

	addLinkedIn(handle: string): Person {
		this.socialAccounts.linkedin = { handle };
		return this;
	}

	addMastodon(handle: string): Person {
		this.socialAccounts.mastodon = { handle };
		return this;
	}

	addX(handle: string): Person {
		this.socialAccounts.x = { handle };
		return this;
	}

	addYouTube(handle: string): Person {
		this.socialAccounts.youtube = { handle };
		return this;
	}
}

interface SocialAccounts {
	blueSky?: SocialAccount;
	discord?: SocialAccount;
	linkedin?: SocialAccount;
	mastodon?: SocialAccount;
	x?: SocialAccount;
	youtube?: SocialAccount;
};

interface SocialAccount {
	handle: string;
}
