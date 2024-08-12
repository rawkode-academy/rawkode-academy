import {
	EncryptedVaultDmnoPlugin,
	EncryptedVaultTypes,
} from "@dmno/encrypted-vault-plugin";
import { configPath, defineDmnoService } from "dmno";

const rootVault = new EncryptedVaultDmnoPlugin("vault/root", {
	key: configPath("DMNO_VAULT_KEY_ROOT"),
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
		DMNO_VAULT_KEY: {
			extends: EncryptedVaultTypes.encryptionKey,
		},
	},
});
