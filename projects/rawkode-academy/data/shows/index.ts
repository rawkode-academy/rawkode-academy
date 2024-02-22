import { loader } from "../utils";
import { Person } from "../people";

export const loadShows = async () => loader<Show>("shows");

export class Show {
	public readonly id: string;
	public readonly name;
	protected hosts: Person[] = [];

	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
	}

	addHost(host: Person): Show {
		this.hosts.push(host);
		return this;
	}
}
