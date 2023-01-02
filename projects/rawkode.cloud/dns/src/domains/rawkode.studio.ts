import { ManagedZone } from "../domains";

export const rawkodeStudio = new ManagedZone("rawkode-studio", {
	domain: "rawkode.studio",
	description: "Managed by Pulumi",
}).disableEmail();
