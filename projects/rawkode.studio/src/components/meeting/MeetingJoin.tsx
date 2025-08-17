import { AlertCircle, ArrowLeft, LogIn } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
	MeetingProvider,
	useMeeting,
} from "@/components/meeting/MeetingProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	createAuditLog,
	generateParticipantId,
	logSecurityEvent,
	sanitizeInput,
} from "@/lib/auth/security";

function MeetingJoinContent() {
	const { meetingId } = useParams<{ meetingId: string }>();
	const navigate = useNavigate();
	const nameId = useId();
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

	const [participantName, setParticipantName] = useState(
		user?.name || user?.email || "",
	);
	const [isJoining, setIsJoining] = useState(false);

	const handleBackToDashboard = () => {
		navigate("/dashboard");
	};

	const handleLogin = () => {
		window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
	};

	const handleJoinMeeting = useCallback(async () => {
		if (!meetingId || isJoining || !canJoin) {
			return;
		}

		// Use participant name from user or form input
		const finalName = user?.name || user?.email || participantName.trim();
		if (!finalName) {
			return; // Don't auto-join if no name available
		}

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

			// Redirect to the meeting room with setup screen enabled
			navigate(
				`/room/${meetingId}?token=${participantData.token}&name=${encodeURIComponent(sanitizedName)}&preset=${preset}`,
			);
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
	}, [
		meetingId,
		isJoining,
		canJoin,
		user,
		participantName,
		preset,
		roleDisplayName,
		navigate,
	]);

	// Auto-start join process for authenticated users or when name is available
	useEffect(() => {
		if (
			meeting &&
			canJoin &&
			meeting.status === "ACTIVE" &&
			!isJoining &&
			(user?.name || (!user && participantName.trim()))
		) {
			// Start join process automatically
			handleJoinMeeting();
		}
	}, [meeting, canJoin, user, participantName, isJoining, handleJoinMeeting]);

	// Loading state
	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-white">Loading meeting...</p>
				</div>
			</div>
		);
	}

	// Joining state
	if (isJoining) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-white text-lg">Preparing to join meeting...</p>
					<p className="text-gray-400 text-sm mt-2">
						Setting up your session as {user?.name || participantName}
					</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
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
							{error?.message || "Failed to load meeting"}
						</p>
						<div className="flex space-x-3">
							<Button
								variant="outline"
								onClick={handleBackToDashboard}
								className="flex-1"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Dashboard
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
						<Button onClick={handleBackToDashboard} className="w-full">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Access denied (only for inactive meetings now)
	if (!canJoin) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
				<Card className="bg-gray-800 border-gray-700 max-w-md w-full">
					<CardHeader>
						<CardTitle className="text-white">Meeting Unavailable</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-300 mb-4">
							{accessReason || "This meeting is not currently available."}
						</p>
						<div className="space-y-3">
							<Button
								variant="outline"
								onClick={handleBackToDashboard}
								className="w-full"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Dashboard
							</Button>
							<Button
								onClick={() => window.location.reload()}
								className="w-full"
							>
								Refresh
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// For guests who need to enter their name
	if (!user && !participantName.trim()) {
		return (
			<div className="min-h-screen bg-gray-900">
				{/* Header */}
				<div className="bg-gray-800 border-b border-gray-700 p-4">
					<div className="max-w-4xl mx-auto flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Button
								variant="ghost"
								onClick={handleBackToDashboard}
								className="text-white hover:bg-gray-700"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back
							</Button>
							<div>
								<h1 className="text-white font-semibold">{meeting.title}</h1>
								<div className="flex items-center space-x-4 text-sm text-gray-400">
									<span>Livestream Meeting</span>
									<Badge
										variant={
											meeting.status === "ACTIVE" ? "default" : "secondary"
										}
									>
										{meeting.status}
									</Badge>
								</div>
							</div>
						</div>
						<div className="flex items-center space-x-2">
							<Badge
								variant="outline"
								className="text-blue-400 border-blue-400"
							>
								{roleDisplayName}
							</Badge>
						</div>
					</div>
				</div>

				{/* Name Input Form */}
				<div className="max-w-2xl mx-auto p-6">
					<Card className="bg-gray-800 border-gray-700">
						<CardHeader>
							<CardTitle className="text-white">Join Meeting</CardTitle>
							<p className="text-gray-400">
								Enter your name to join as a {roleDisplayName}.
							</p>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Login option */}
							<div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-blue-200 text-sm">
											Want host controls? Login to get director privileges.
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={handleLogin}
										className="ml-4 shrink-0"
									>
										<LogIn className="h-4 w-4 mr-2" />
										Login
									</Button>
								</div>
							</div>

							{/* Name Input */}
							<div className="space-y-2">
								<Label htmlFor={nameId} className="text-white">
									Display Name
								</Label>
								<Input
									id={nameId}
									type="text"
									value={participantName}
									onChange={(e) => setParticipantName(e.target.value)}
									placeholder="Enter your name"
									className="bg-gray-700 border-gray-600 text-white"
									required
									maxLength={100}
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter" && participantName.trim()) {
											handleJoinMeeting();
										}
									}}
								/>
								<p className="text-xs text-gray-400">
									Press Enter or click Join to continue
								</p>
							</div>

							{/* Join Button */}
							<Button
								onClick={handleJoinMeeting}
								disabled={!participantName.trim() || isJoining}
								className="w-full"
								size="lg"
							>
								Join Meeting
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// If we get here, join should happen automatically
	// This is a fallback just in case
	return (
		<div className="min-h-screen bg-gray-900 flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
				<p className="text-white text-lg">Preparing to join meeting...</p>
				<p className="text-gray-400 text-sm mt-2">
					Please wait while we set up your session
				</p>
			</div>
		</div>
	);
}

export function MeetingJoin() {
	const { meetingId } = useParams<{ meetingId: string }>();

	if (!meetingId) {
		return (
			<div className="min-h-screen bg-gray-900 flex items-center justify-center">
				<p className="text-white">Invalid meeting ID</p>
			</div>
		);
	}

	return (
		<MeetingProvider meetingId={meetingId}>
			<MeetingJoinContent />
		</MeetingProvider>
	);
}
