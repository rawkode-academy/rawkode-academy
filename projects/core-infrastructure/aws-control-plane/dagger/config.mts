import { Config } from "@rawkode.academy/dagger/pulumi/dagger.mjs";

export const pulumiConfig: Config = {
	version: "3.51.0",
	runtime: "nodejs",
	stackCreate: false,
};
