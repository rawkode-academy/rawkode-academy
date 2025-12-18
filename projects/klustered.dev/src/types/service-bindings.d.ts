interface PreferencePayload {
	audience: string;
	channel: string;
	status: "subscribed" | "unsubscribed";
	source?: string;
}

interface Preference {
	userId: string;
	channel: string;
	audience: string;
	createdAt: string;
}

interface EmailPreferencesRPC {
	setPreference(
		userId: string,
		payload: PreferencePayload,
	): Promise<{ success: boolean }>;
	getPreferences(
		userId?: string,
		channel?: string,
		audience?: string,
	): Promise<Preference[]>;
}

export interface TypedEnv {
	SESSION: KVNamespace;
	IDENTITY: Fetcher;
	ASSETS: Fetcher;
	EMAIL_PREFERENCES: EmailPreferencesRPC;
}
