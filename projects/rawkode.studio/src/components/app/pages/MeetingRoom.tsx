import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { VideoMeeting } from "@/components/app/components/VideoMeeting";
import { useAuth } from "@/components/app/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logSessionEvent, validateSessionData } from "@/lib/auth/security";
import {
	clearMeetingSession,
	getMeetingSession,
	type MeetingSessionData,
} from "@/lib/meeting-session";
import type { Meeting } from "@/lib/realtime-kit/client";

export function MeetingRoom() {
	const { id } = useParams<{ id: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { user } = useAuth();

	// State for session data
	const [sessionData, setSessionData] = useState<MeetingSessionData | null>(
		null,
	);
	const [isLoadingSession, setIsLoadingSession] = useState(true);

	// Load meeting session data
	useEffect(() => {
		if (!id) {
			setIsLoadingSession(false);
			return;
		}

		getMeetingSession(id)
			.then((data) => {
				if (data) {
					// Validate session data
					const validation = validateSessionData(data, id, user?.sub);
					if (validation.isValid) {
						setSessionData(data);
						logSessionEvent("session_accessed", id, user?.sub, {
							sessionId: data.sessionId,
						});
					} else {
						console.warn("Invalid session data:", validation.reason);
						logSessionEvent("session_invalid", id, user?.sub, {
							reason: validation.reason,
						});
						// Clear invalid session data
						clearMeetingSession(id);
					}
				}
				setIsLoadingSession(false);
			})
			.catch((error) => {
				console.warn("Failed to load session data:", error);
				logSessionEvent("session_invalid", id, user?.sub, {
					error: error instanceof Error ? error.message : "Session load error",
				});
				setIsLoadingSession(false);
			});
	}, [id, user]);

	// Clean up session data when component unmounts or meeting is accessed
	useEffect(() => {
		return () => {
			if (id && sessionData) {
				clearMeetingSession(id);
			}
		};
	}, [id, sessionData]);

	// Get token and participant info from session storage or URL params (fallback)
	const token = sessionData?.token || searchParams.get("token");
	const participantName =
		sessionData?.participantName ||
		searchParams.get("name") ||
		user?.name ||
		user?.email ||
		"Anonymous";
	const preset = (sessionData?.preset ||
		searchParams.get("preset") ||
		"livestream_viewer") as "livestream_viewer" | "livestream_host";

	// Fetch meeting details
	const {
		data: meeting,
		isLoading: isMeetingLoading,
		error: meetingError,
	} = useQuery<Meeting>({
		queryKey: ["meeting", id, user ? "authenticated" : "public"],
		queryFn: async () => {
			// Use public endpoint for anonymous users, authenticated endpoint for logged-in users
			const endpoint = user
				? `/api/meetings/${id}`
				: `/api/meetings/${id}/public`;

			const response = await fetch(endpoint);
			if (!response.ok) {
				throw new Error("Failed to fetch meeting details");
			}
			return response.json();
		},
		enabled: !!id,
	});

	// Clear session data once we have successfully loaded meeting and token
	useEffect(() => {
		if (meeting && token && sessionData) {
			// Clear session data after successful use to prevent token reuse
			setTimeout(() => {
				if (id) {
					clearMeetingSession(id);
				}
			}, 1000); // Small delay to ensure meeting initialization starts
		}
	}, [meeting, token, sessionData, id]);

	const handleLeaveMeeting = () => {
		// Redirect to prejoin screen for the same meeting
		navigate(`/join/${id}`);
	};

	const handleBackToMeetingDetails = () => {
		navigate(`/meetings/${id}`);
	};

	// Early returns for loading/error states
	if (!id) {
		return null;
	}

	// Loading state
	if (isMeetingLoading || isLoadingSession) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
					<p className="text-white">
						{isLoadingSession ? "Loading session..." : "Loading meeting..."}
					</p>
				</div>
			</div>
		);
	}

	// Error state
	if (meetingError) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
				<Card className="bg-gray-800 border-gray-700 max-w-md w-full">
					<CardHeader>
						<CardTitle className="text-white flex items-center">
							<AlertCircle className="h-5 w-5 mr-2 text-red-500" />
							Meeting Error
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-300 mb-4">
							{meetingError?.message || "Failed to load meeting"}
						</p>
						<div className="flex space-x-3">
							<Button
								variant="outline"
								onClick={handleBackToMeetingDetails}
								className="flex-1"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back
							</Button>
							<Button
								onClick={() => window.location.reload()}
								className="flex-1"
							>
								Retry
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// No meeting found
	if (!meeting) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
				<Card className="bg-gray-800 border-gray-700 max-w-md w-full">
					<CardHeader>
						<CardTitle className="text-white">Meeting Not Found</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-300 mb-4">
							The meeting you're looking for doesn't exist or has been deleted.
						</p>
						<Button onClick={handleBackToMeetingDetails} className="w-full">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Check if meeting is active
	if (meeting.status !== "ACTIVE") {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
				<Card className="bg-gray-800 border-gray-700 max-w-md w-full">
					<CardHeader>
						<CardTitle className="text-white">Meeting Inactive</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-300 mb-4">
							This meeting is currently inactive and cannot be joined.
						</p>
						<Button onClick={handleBackToMeetingDetails} className="w-full">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Require token to join meeting room
	if (!token) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
				<Card className="bg-gray-800 border-gray-700 max-w-md w-full">
					<CardHeader>
						<CardTitle className="text-white">Access Required</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-300 mb-4">
							You need a valid token to join this meeting room.
						</p>
						<Button onClick={() => navigate(`/join/${id}`)} className="w-full">
							Join Meeting
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Active meeting with token
	return (
		<VideoMeeting
			meetingId={meeting.id}
			authToken={token}
			participantName={participantName}
			preset={preset}
			showSetupScreen={true}
			onLeave={handleLeaveMeeting}
		/>
	);
}
