interface Env {
	AI: Ai;

	RandomVideoSocialPost: Workflow;

	BLUESKY_HANDLE: string;
	BLUESKY_APP_PASSWORD: SecretsStoreSecret;

	LINKEDIN_USER_ID: string;
	LINKEDIN_ACCESS_TOKEN: SecretsStoreSecret;

	ZULIP_SERVER_URL: string;
	ZULIP_BOT_EMAIL: string;
	ZULIP_STREAM_NAME: string;
	ZULIP_BOT_API_KEY: SecretsStoreSecret;
}
