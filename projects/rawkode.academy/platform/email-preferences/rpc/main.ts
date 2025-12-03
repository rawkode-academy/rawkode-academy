import { EmailPreferencesService } from "./rpc-service.js";

export interface Env {
	DB: D1Database;
	ANALYTICS: Fetcher;
}

export default EmailPreferencesService;
