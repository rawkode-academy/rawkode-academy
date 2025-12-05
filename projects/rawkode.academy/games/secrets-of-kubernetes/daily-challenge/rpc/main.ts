import { SkiDailyChallenge } from "./rpc-service.js";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
}

export default SkiDailyChallenge;
