import { RealtimeKitClient } from "./client";

export type * from "./client";
export { RealtimeKitClient } from "./client";

// Helper function to get a configured client instance
export function getRealtimeKitClient() {
	return new RealtimeKitClient();
}
