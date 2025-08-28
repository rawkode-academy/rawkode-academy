/**
 * Simple session storage utility for meeting data
 * Stores meeting join data in sessionStorage
 */

export interface MeetingSessionData {
	token: string;
	participantName: string;
	preset: "livestream_viewer" | "livestream_host";
	sessionId: string;
}

const STORAGE_KEY_PREFIX = "rws_meeting_";

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	return `${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Generate storage key for a meeting session
 */
function getStorageKey(meetingId: string): string {
	return `${STORAGE_KEY_PREFIX}${meetingId}`;
}

/**
 * Check if session storage is available
 */
function isSessionStorageAvailable(): boolean {
	try {
		return typeof window !== "undefined" && !!window.sessionStorage;
	} catch {
		return false;
	}
}

/**
 * Store meeting session data
 */
export function storeMeetingSession(
	meetingId: string,
	data: Omit<MeetingSessionData, "sessionId">,
): string {
	if (!isSessionStorageAvailable()) {
		throw new Error("Session storage not available");
	}

	const sessionData: MeetingSessionData = {
		token: data.token,
		participantName: data.participantName,
		preset: data.preset,
		sessionId: generateSessionId(),
	};

	try {
		sessionStorage.setItem(
			getStorageKey(meetingId),
			JSON.stringify(sessionData),
		);

		return sessionData.sessionId;
	} catch (error) {
		console.error("Failed to store meeting session:", error);
		throw new Error("Failed to store meeting session");
	}
}

/**
 * Retrieve meeting session data
 */
export function getMeetingSession(
	meetingId: string,
): MeetingSessionData | null {
	if (!isSessionStorageAvailable()) {
		return null;
	}

	try {
		const storedData = sessionStorage.getItem(getStorageKey(meetingId));
		if (!storedData) {
			return null;
		}

		const sessionData: MeetingSessionData = JSON.parse(storedData);
		return sessionData;
	} catch (error) {
		console.error("Failed to retrieve meeting session:", error);
		clearMeetingSession(meetingId);
		return null;
	}
}

/**
 * Clear meeting session data
 */
export function clearMeetingSession(meetingId: string): void {
	if (!isSessionStorageAvailable()) {
		return;
	}

	try {
		sessionStorage.removeItem(getStorageKey(meetingId));
	} catch (error) {
		console.warn("Failed to clear meeting session:", error);
	}
}

/**
 * Clear all meeting sessions (cleanup utility)
 */
export function clearAllMeetingSessions(): void {
	if (!isSessionStorageAvailable()) {
		return;
	}

	try {
		const keys = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key?.startsWith(STORAGE_KEY_PREFIX)) {
				keys.push(key);
			}
		}

		keys.forEach((key) => {
			sessionStorage.removeItem(key);
		});
	} catch (error) {
		console.warn("Failed to clear all meeting sessions:", error);
	}
}

/**
 * Get session info for validation
 */
export function getMeetingSessionInfo(meetingId: string): {
	exists: boolean;
	sessionId?: string;
} {
	if (!isSessionStorageAvailable()) {
		return { exists: false };
	}

	try {
		const storedData = sessionStorage.getItem(getStorageKey(meetingId));
		if (!storedData) {
			return { exists: false };
		}

		const sessionData: MeetingSessionData = JSON.parse(storedData);

		return {
			exists: true,
			sessionId: sessionData.sessionId,
		};
	} catch {
		return { exists: false };
	}
}
