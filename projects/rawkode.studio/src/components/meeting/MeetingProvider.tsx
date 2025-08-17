import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/components/app/contexts/AuthContext";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth/auth-types";
import { validateMeetingAccess } from "@/lib/auth/security";
import type { Meeting } from "@/lib/realtime-kit/client";

interface MeetingContextValue {
	meeting: Meeting | undefined;
	isLoading: boolean;
	error: Error | null;
	user: OidcStandardClaimsWithRoles | null;
	preset: "livestream_viewer" | "livestream_host";
	roleDisplayName: string;
	isDirector: boolean;
	canJoin: boolean;
	canControl: boolean;
	accessReason?: string;
}

const MeetingContext = createContext<MeetingContextValue | undefined>(
	undefined,
);

interface MeetingProviderProps {
	children: React.ReactNode;
	meetingId: string;
}

export function MeetingProvider({ children, meetingId }: MeetingProviderProps) {
	const { user } = useAuth(); // User from Astro.locals.user

	// Fetch meeting data using appropriate endpoint based on auth status
	const {
		data: meeting,
		isLoading,
		error,
	} = useQuery<Meeting>({
		queryKey: ["meeting", meetingId, user ? "authenticated" : "public"],
		queryFn: async () => {
			// Use public endpoint for anonymous users, authenticated endpoint for logged-in users
			const endpoint = user
				? `/api/meetings/${meetingId}`
				: `/api/meetings/${meetingId}/public`;

			const response = await fetch(endpoint);
			if (!response.ok) {
				throw new Error("Failed to fetch meeting details");
			}
			return response.json();
		},
		enabled: !!meetingId,
		retry: 1,
		staleTime: 30000, // 30 seconds
	});

	// Calculate access permissions and preset
	const accessInfo = useMemo(() => {
		if (!meeting) {
			return {
				preset: "livestream_viewer" as const,
				roleDisplayName: "Guest",
				isDirector: false,
				canJoin: false,
				canControl: false,
				accessReason: "Meeting not found",
			};
		}

		// Validate join access
		const joinAccess = validateMeetingAccess(user, meeting, "join");

		// Validate control access
		const controlAccess = validateMeetingAccess(user, meeting, "control");

		return {
			preset: joinAccess.preset,
			roleDisplayName:
				joinAccess.preset === "livestream_host" ? "Host" : "Viewer",
			isDirector: joinAccess.preset === "livestream_host",
			canJoin: joinAccess.canAccess,
			canControl: controlAccess.canAccess,
			accessReason: joinAccess.reason || controlAccess.reason,
		};
	}, [user, meeting]);

	const contextValue: MeetingContextValue = {
		meeting,
		isLoading,
		error,
		user,
		...accessInfo,
	};

	return (
		<MeetingContext.Provider value={contextValue}>
			{children}
		</MeetingContext.Provider>
	);
}

export function useMeeting() {
	const context = useContext(MeetingContext);
	if (context === undefined) {
		throw new Error("useMeeting must be used within a MeetingProvider");
	}
	return context;
}

/**
 * Hook for getting meeting preset based on user role
 */
export function useMeetingPreset() {
	const { preset, roleDisplayName, isDirector } = useMeeting();
	return { preset, roleDisplayName, isDirector };
}

/**
 * Hook for meeting access validation
 */
export function useMeetingAccess() {
	const { canJoin, canControl, accessReason } = useMeeting();
	return { canJoin, canControl, accessReason };
}
