import { defineDmnoService, DmnoBaseTypes } from "dmno";
import {
	OnePasswordDmnoPlugin,
	OnePasswordTypes,
} from "@dmno/1password-plugin";

const onePassword = new OnePasswordDmnoPlugin("onepassword", { token: " " });

export default defineDmnoService({
	isRoot: true,
	name: "infrastructure/dns",
	settings: {
		redactSensitiveLogs: true,
		interceptSensitiveLeakRequests: true,
		preventClientLeaks: true,
	},
	schema: {
		OP_TOKEN: {
			extends: OnePasswordTypes.serviceAccountToken,
		},
		TF_HTTP_PASSWORD: {
			extends: DmnoBaseTypes.string,
			sensitive: true,
			value: onePassword.itemByReference(
				"op://sa-core-infrastructure/cloudflare/terraform-state-backend/password"
			),
		},
		CLOUDFLARE_API_TOKEN: {
			extends: DmnoBaseTypes.string,
			sensitive: true,
			value: onePassword.itemByReference(
				"op://Private/w3etxulw37bsqb2rsna5px7y4u/api-tokens/all-access"
			),
		},
		DNSIMPLE_ACCOUNT: {
			extends: DmnoBaseTypes.string,
			sensitive: false,
			value: "126046",
		},
		DNSIMPLE_TOKEN: {
			extends: DmnoBaseTypes.string,
			sensitive: true,
			value: onePassword.itemByReference("op://Private/Dnsimple/api-token"),
		},
		CLOUDFLARE_ACCOUNT_ID: {
			extends: DmnoBaseTypes.string,
			sensitive: false,
			value: "0aeb879de8e3cdde5fb3d413025222ce",
		},
	},
});
