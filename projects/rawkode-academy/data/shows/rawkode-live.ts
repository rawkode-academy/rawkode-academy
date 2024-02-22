import { Show } from ".";
import { default as rawkode } from "../people/rawkode";

export default
	new Show("rawkode-live", "Rawkode Live")
		.addHost(rawkode);
