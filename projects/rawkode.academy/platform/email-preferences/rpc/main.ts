import { EmailPreferences } from "./rpc-service.js";

export interface Env {
	DB: D1Database;
	ANALYTICS: Fetcher;
}

export default EmailPreferences;
