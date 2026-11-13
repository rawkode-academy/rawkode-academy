import { EmailService } from "./http-service.js";

export interface Env {
	SEND_EMAIL: SendEmail;
	EMAIL_PREFERENCES: Fetcher;
	ANALYTICS: Fetcher;
}

export default EmailService;
