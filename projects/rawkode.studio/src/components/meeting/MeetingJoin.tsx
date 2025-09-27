import { AlertCircle, LogIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
	MeetingProvider,
	useMeeting,
} from "@/components/meeting/MeetingProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	createAuditLog,
	generateParticipantId,
	logSecurityEvent,
	logSessionEvent,
	sanitizeInput,
} from "@/lib/auth/security";
import { storeMeetingSession } from "@/lib/meeting-session";

function MeetingJoinContent() {
	const { meetingId } = useParams<{ meetingId: string }>();
	const navigate = useNavigate();
	const {
		meeting,
		isLoading,
		error,
		user,
		preset,
		roleDisplayName,
		canJoin,
		accessReason,
	} = useMeeting();

	const [isJoining, setIsJoining] = useState(false);

	const handleLogin = () => {
		window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
	};

	const handleJoinMeeting = useCallback(async () => {
		if (!meetingId || isJoining || !canJoin) {
			return;
		}

		// Use participant name from user or default to Guest
		const finalName = user?.name || user?.email || "Guest";

		const sanitizedName = sanitizeInput(finalName);
		if (!sanitizedName) {
			alert("Please enter a valid name");
			return;
		}

		setIsJoining(true);

		try {
			// Add participant to the meeting
			const participantResponse = await fetch(
				`/api/meetings/${meetingId}/participants`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: sanitizedName,
						preset_name: preset,
						custom_participant_id: generateParticipantId(user),
					}),
				},
			);

			if (!participantResponse.ok) {
				const errorData = await participantResponse.json().catch(() => ({}));
				throw new Error(
					errorData.error || "Failed to add participant to meeting",
				);
			}

			const participantData = await participantResponse.json();

			// Log successful join attempt
			logSecurityEvent(
				createAuditLog({
					userId: user?.sub || "anonymous",
					action: "meeting_join",
					resource: meetingId,
					success: true,
					metadata: {
						preset,
						role: roleDisplayName,
						participantName: sanitizedName,
					},
				}),
			);

			// Store sensitive data in secure session storage
			try {
				const sessionId = storeMeetingSession(meetingId, {
					token: participantData.token,
					participantName: sanitizedName,
					preset,
				});

				// Log successful session creation
				logSessionEvent("session_created", meetingId, user?.sub, {
					sessionId,
					preset,
					participantName: sanitizedName,
				});

				// Navigate with clean URL (no sensitive data)
				navigate(`/room/${meetingId}`);
			} catch (sessionError) {
				console.warn(
					"Failed to store session data, falling back to URL params:",
					sessionError,
				);

				// Log session creation failure
				logSessionEvent("session_invalid", meetingId, user?.sub, {
					error:
						sessionError instanceof Error
							? sessionError.message
							: "Unknown session error",
					fallbackToUrl: true,
				});

				// Fallback to URL params if sessionStorage fails
				navigate(
					`/room/${meetingId}?token=${participantData.token}&name=${encodeURIComponent(sanitizedName)}&preset=${preset}`,
				);
			}
		} catch (error) {
			console.error("Failed to join meeting:", error);

			// Log failed join attempt
			logSecurityEvent(
				createAuditLog({
					userId: user?.sub || "anonymous",
					action: "meeting_join",
					resource: meetingId,
					success: false,
					metadata: {
						error: error instanceof Error ? error.message : "Unknown error",
						preset,
						role: roleDisplayName,
					},
				}),
			);

			alert(error instanceof Error ? error.message : "Failed to join meeting");
			setIsJoining(false);
		}
	}, [meetingId, isJoining, canJoin, user, preset, roleDisplayName, navigate]);

	// Auto-start join process only for authenticated users with existing names
	useEffect(() => {
		if (
			meeting &&
			canJoin &&
			meeting.status === "ACTIVE" &&
			!isJoining &&
			user?.name
		) {
			// Start join process automatically only for authenticated users
			handleJoinMeeting();
		}
	}, [meeting, canJoin, user, isJoining, handleJoinMeeting]);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-foreground">Loading meeting...</p>
				</div>
			</div>
		);
	}

	// Joining state
	if (isJoining) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-foreground text-lg">
						Preparing to join meeting...
					</p>
					<p className="text-muted-foreground text-sm mt-2">
						Setting up your session as {user?.name || user?.email || "Guest"}
					</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="flex items-center justify-center py-20 px-4">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle className="flex items-center">
							<AlertCircle className="h-5 w-5 mr-2 text-red-500" />
							Meeting Error
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							{error?.message || "Failed to load meeting"}
						</p>
						<Button onClick={() => window.location.reload()} className="w-full">
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// No meeting found
	if (!meeting) {
		return (
			<div className="flex items-center justify-center py-20 px-4">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle>Meeting Not Found</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							The meeting you're looking for doesn't exist or has been deleted.
						</p>
						<Button onClick={() => window.location.reload()} className="w-full">
							Retry
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Access denied (only for inactive meetings now)
	if (!canJoin) {
		return (
			<div className="flex items-center justify-center py-20 px-4">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle>Meeting Unavailable</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							{accessReason || "This meeting is not currently available."}
						</p>
						<Button onClick={() => window.location.reload()} className="w-full">
							Refresh
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Guest user UI - show login and join options
	return (
		<div>
			{/* Header */}
			<div className="bg-card border-b border-border p-4">
				<div className="max-w-4xl mx-auto flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div>
							<h1 className="text-foreground font-semibold">{meeting.title}</h1>
							<div className="flex items-center space-x-4 text-sm text-muted-foreground">
								<span>Livestream Meeting</span>
								<Badge
									variant={
										meeting.status === "ACTIVE" ? "success" : "secondary"
									}
								>
									{meeting.status}
								</Badge>
							</div>
						</div>
					</div>
					<div className="flex items-center space-x-2">
						<Badge variant="outline" className="text-primary border-primary">
							{roleDisplayName}
						</Badge>
					</div>
				</div>
			</div>

			{/* Join Options */}
			<div className="max-w-2xl mx-auto p-6">
				<Card>
					<CardHeader>
						<CardTitle>Join Meeting</CardTitle>
						<p className="text-muted-foreground">
							Choose how you'd like to join as a {roleDisplayName}.
						</p>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Login option */}
						<div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-primary font-medium">
										Login for Full Features
									</h3>
									<p className="text-primary/80 text-sm mt-1">
										Access host controls and personalized settings
									</p>
								</div>
								<Button
									variant="outline"
									onClick={handleLogin}
									className="ml-4 shrink-0"
								>
									<LogIn className="h-4 w-4 mr-2" />
									Login
								</Button>
							</div>
						</div>

						{/* Quick join option */}
						<div className="bg-muted/50 border border-border rounded-lg p-4">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-foreground font-medium">Join as Guest</h3>
									<p className="text-muted-foreground text-sm mt-1">
										Quick access with limited features
									</p>
								</div>
								<Button
									onClick={handleJoinMeeting}
									disabled={isJoining}
									className="ml-4 shrink-0"
								>
									Join Now
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export function MeetingJoin() {
	const { meetingId } = useParams<{ meetingId: string }>();

	if (!meetingId) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-foreground">Invalid meeting ID</p>
			</div>
		);
	}

	return (
		<MeetingProvider meetingId={meetingId}>
			<MeetingJoinContent />
		</MeetingProvider>
	);
}
