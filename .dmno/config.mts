import {
	OnePasswordDmnoPlugin,
	OnePasswordTypes,
} from "@dmno/1password-plugin";
import {
	EncryptedVaultDmnoPlugin,
	EncryptedVaultTypes,
} from "@dmno/encrypted-vault-plugin";
import { configPath, defineDmnoService } from "dmno";

const rootVault = new EncryptedVaultDmnoPlugin("vault/root", {
	name: "root",
	key: configPath("DMNO_VAULT_KEY_ROOT"),
});

const OnePassBackend = new OnePasswordDmnoPlugin("1password", {
	token: configPath("OP_TOKEN"),
	fallbackToCliBasedAuth: true,
});

export default defineDmnoService({
	isRoot: true,
	settings: {
		redactSensitiveLogs: true,
		interceptSensitiveLeakRequests: true,
		preventClientLeaks: true,
	},
	schema: {
		CLOUDFLARE_ACCOUNT_ID: {
			sensitive: false,
			description: "Rawkode Academy's Cloudflare Account ID",
			value: "0aeb879de8e3cdde5fb3d413025222ce",
		},
		DMNO_VAULT_KEY_ROOT: {
			extends: EncryptedVaultTypes.encryptionKey,
		},
		OP_TOKEN: {
			extends: OnePasswordTypes.serviceAccountToken,
		},
	},
});
