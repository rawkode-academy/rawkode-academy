import { EmailService } from "./rpc-service.js";

export interface Env {
	SEND_EMAIL: SendEmail;
	EMAIL_PREFERENCES: Fetcher;
}

export default EmailService;
