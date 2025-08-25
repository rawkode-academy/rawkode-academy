import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowLeft,
	Brain,
	Circle,
	Clock,
	Copy,
	Download,
	FileText,
	Headphones,
	MessageSquare,
	Mic,
	MicOff,
	Monitor,
	PauseCircle,
	PlayCircle,
	Radio,
	Shield,
	Users,
	Video,
	Wifi,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/lib/realtime-kit/client";

export function MeetingDetails() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const {
		data: meeting,
		isLoading,
		error,
	} = useQuery<Meeting>({
		queryKey: ["meeting", id],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}`);
			if (!response.ok) {
				throw new Error("Failed to fetch meeting details");
			}
			return response.json();
		},
		enabled: !!id,
	});

	const { data: session } = useQuery({
		queryKey: ["meeting", id, "session"],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}/session`);
			if (!response.ok) {
				throw new Error("Failed to fetch session");
			}
			return response.json();
		},
		enabled: !!id,
	});

	const { data: livestream } = useQuery({
		queryKey: ["meeting", id, "livestream"],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}/livestream`);
			if (!response.ok) {
				throw new Error("Failed to fetch livestream");
			}
			return response.json();
		},
		enabled: !!id,
	});

	const { data: participants } = useQuery({
		queryKey: ["meeting", id, "participants"],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}/participants`);
			if (!response.ok) {
				throw new Error("Failed to fetch participants");
			}
			return response.json();
		},
		enabled: !!id,
	});

	const { data: recordings } = useQuery({
		queryKey: ["meeting", id, "recordings"],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}/recordings`);
			if (!response.ok) {
				throw new Error("Failed to fetch recordings");
			}
			return response.json();
		},
		enabled: !!id,
	});

	const { data: sessionSummary } = useQuery({
		queryKey: ["session", session?.id, "summary"],
		queryFn: async () => {
			if (!session?.id) {
				throw new Error("Session ID is required");
			}
			const response = await fetch(`/api/sessions/${session.id}/summary`);
			if (!response.ok) {
				throw new Error("Failed to fetch summary");
			}
			return response.json();
		},
		enabled: !!session?.id,
	});

	const { data: chatMessages } = useQuery({
		queryKey: ["meeting", id, "chat"],
		queryFn: async () => {
			const response = await fetch(`/api/meetings/${id}/chat`);
			if (!response.ok) {
				throw new Error("Failed to fetch chat messages");
			}
			return response.json();
		},
		enabled: !!id && meeting?.persist_chat,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);
	}

	if (error || !meeting) {
		return (
			<div className="max-w-4xl mx-auto">
				<Button
					onClick={() => navigate("/dashboard")}
					variant="ghost"
					className="mb-4"
				>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Dashboard
				</Button>
				<div className="text-center py-8">
					<p className="text-red-500">Failed to load meeting details</p>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto">
			<Button
				onClick={() => navigate("/dashboard")}
				variant="ghost"
				className="mb-6"
			>
				<ArrowLeft className="mr-2 h-4 w-4" />
				Back to Dashboard
			</Button>

			<div className="space-y-6">
				<Card>
					<CardHeader className="space-y-6 pb-6">
						{/* Title with Status on same row */}
						<div className="flex items-start justify-between gap-4">
							<h1 className="text-2xl font-bold tracking-tight">
								{meeting.title || `Meeting ${meeting.id.slice(0, 8)}`}
							</h1>

							<div className="flex items-center gap-2">
								<span
									className={cn(
										"inline-flex items-center text-sm font-medium px-2 py-1 rounded-full",
										meeting.status === "ACTIVE"
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
											: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
									)}
								>
									<Circle
										className={cn(
											"mr-1.5 h-2 w-2 fill-current",
											meeting.status === "ACTIVE" && "animate-pulse",
										)}
									/>
									{meeting.status || "Inactive"}
								</span>

								{meeting.preferred_region && (
									<span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded-full">
										{meeting.preferred_region}
									</span>
								)}
							</div>
						</div>

						{/* Metadata - Full width flexbox */}
						<div className="flex justify-between items-start pt-4">
							<div className="flex-1">
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
									Meeting ID
								</p>
								<div className="flex items-center gap-2">
									<code className="text-sm font-mono truncate">
										{meeting.id}
									</code>
									<button
										type="button"
										onClick={() => navigator.clipboard.writeText(meeting.id)}
										className="text-muted-foreground hover:text-foreground transition-colors"
										title="Copy Meeting ID"
									>
										<Copy className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>

							<div className="flex-1 text-center">
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
									Created
								</p>
								<p className="text-sm">
									{new Date(meeting.created_at).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}
								</p>
							</div>

							<div className="flex-1 text-right">
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
									Last Updated
								</p>
								<p className="text-sm">
									{meeting.updated_at
										? new Date(meeting.updated_at).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})
										: "—"}
								</p>
							</div>
						</div>
					</CardHeader>

					{/* Configuration Section - Pills stretched horizontally */}
					<CardContent className="border-t">
						<div className="py-4">
							<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
								Meeting Configuration
							</h3>

							<div className="grid grid-cols-4 gap-2">
								<div
									className={cn(
										"flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-colors",
										meeting.record_on_start
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
											: "bg-muted/50 text-muted-foreground",
									)}
								>
									<Video className="h-3 w-3" />
									Recording
								</div>

								<div
									className={cn(
										"flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-colors",
										meeting.live_stream_on_start
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
											: "bg-muted/50 text-muted-foreground",
									)}
								>
									<Radio className="h-3 w-3" />
									Streaming
								</div>

								<div
									className={cn(
										"flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-colors",
										meeting.persist_chat
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
											: "bg-muted/50 text-muted-foreground",
									)}
								>
									<MessageSquare className="h-3 w-3" />
									Chat
								</div>

								<div
									className={cn(
										"flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-colors",
										meeting.summarize_on_end
											? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
											: "bg-muted/50 text-muted-foreground",
									)}
								>
									<Brain className="h-3 w-3" />
									AI Summary
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Active Session Card */}
				{session?.id && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Activity className="h-5 w-5" />
								Active Session
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">Status</span>
									<Badge variant="default" className="bg-green-500">
										<Circle className="mr-1 h-2 w-2 fill-current animate-pulse" />
										Live
									</Badge>
								</div>
								{session.started_at && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Started
										</span>
										<span className="text-sm">
											{new Date(session.started_at).toLocaleTimeString()}
										</span>
									</div>
								)}
								{session.participants && session.participants.length > 0 && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Participants
										</span>
										<Badge variant="secondary">
											<Users className="mr-1 h-3 w-3" />
											{session.participants.length}
										</Badge>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Participants Card */}
				{participants?.data && participants.data.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Participants ({participants.data.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{participants.data
									.slice(0, 5)
									.map(
										(participant: {
											id: string;
											name?: string;
											picture?: string;
											preset_name?: string;
											audio_enabled?: boolean;
											video_enabled?: boolean;
										}) => (
											<div
												key={participant.id}
												className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
											>
												<div className="flex items-center gap-3">
													{participant.picture ? (
														<img
															src={participant.picture}
															alt={participant.name}
															className="h-8 w-8 rounded-full"
														/>
													) : (
														<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
															<Users className="h-4 w-4" />
														</div>
													)}
													<div>
														<p className="text-sm font-medium">
															{participant.name}
														</p>
														{participant.preset_name && (
															<p className="text-xs text-muted-foreground">
																<Shield className="inline h-3 w-3 mr-1" />
																{participant.preset_name}
															</p>
														)}
													</div>
												</div>
												<div className="flex items-center gap-2">
													{participant.audio_enabled !== undefined && (
														<div>
															{participant.audio_enabled ? (
																<Mic className="h-4 w-4 text-green-500" />
															) : (
																<MicOff className="h-4 w-4 text-red-500" />
															)}
														</div>
													)}
													{participant.video_enabled !== undefined && (
														<div>
															{participant.video_enabled ? (
																<Video className="h-4 w-4 text-green-500" />
															) : (
																<Video className="h-4 w-4 text-gray-400" />
															)}
														</div>
													)}
												</div>
											</div>
										),
									)}
								{participants.data.length > 5 && (
									<div className="text-center text-sm text-muted-foreground pt-2">
										and {participants.data.length - 5} more...
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Recordings Card */}
				{(recordings?.data?.length > 0 || session?.recordings?.length > 0) && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Video className="h-5 w-5" />
								Recordings
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{(recordings?.data || session?.recordings || []).map(
									(recording: {
										id: string;
										status: string;
										recording_duration?: number;
										file_size?: number;
										download_url?: string;
										audio_download_url?: string;
									}) => (
										<div
											key={recording.id}
											className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
										>
											<div className="flex items-center gap-3">
												{recording.status === "RECORDING" ? (
													<PlayCircle className="h-4 w-4 text-red-500 animate-pulse" />
												) : recording.status === "PAUSED" ? (
													<PauseCircle className="h-4 w-4 text-yellow-500" />
												) : (
													<Circle className="h-4 w-4 text-gray-500" />
												)}
												<div>
													<p className="text-sm font-medium">
														Recording {recording.id.slice(0, 8)}
													</p>
													<div className="flex items-center gap-3 text-xs text-muted-foreground">
														{recording.recording_duration && (
															<span>
																<Clock className="inline h-3 w-3 mr-1" />
																{Math.floor(recording.recording_duration / 60)}m{" "}
																{recording.recording_duration % 60}s
															</span>
														)}
														{recording.file_size && (
															<span>
																{(recording.file_size / 1024 / 1024).toFixed(1)}{" "}
																MB
															</span>
														)}
													</div>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{recording.download_url &&
													recording.status === "UPLOADED" && (
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																window.open(recording.download_url, "_blank")
															}
														>
															<Download className="h-3 w-3" />
														</Button>
													)}
												{recording.audio_download_url && (
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															window.open(
																recording.audio_download_url,
																"_blank",
															)
														}
														title="Download Audio Only"
													>
														<Headphones className="h-3 w-3" />
													</Button>
												)}
												<Badge
													variant={
														recording.status === "RECORDING"
															? "destructive"
															: recording.status === "PAUSED"
																? "secondary"
																: "outline"
													}
												>
													{recording.status}
												</Badge>
											</div>
										</div>
									),
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Livestream Card */}
				{livestream?.id && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Radio className="h-5 w-5" />
								Livestream
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">Status</span>
									<Badge
										variant={
											livestream.status === "LIVE" ? "destructive" : "secondary"
										}
									>
										{livestream.status === "LIVE" && (
											<Wifi className="mr-1 h-3 w-3 animate-pulse" />
										)}
										{livestream.status}
									</Badge>
								</div>
								{livestream.viewer_count !== undefined && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Viewers
										</span>
										<Badge variant="outline">
											<Monitor className="mr-1 h-3 w-3" />
											{livestream.viewer_count}
										</Badge>
									</div>
								)}
								{livestream.playback_url && (
									<div className="space-y-2">
										<span className="text-sm text-muted-foreground">
											Playback URL
										</span>
										<div className="flex items-center gap-2">
											<code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
												{livestream.playback_url}
											</code>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													navigator.clipboard.writeText(livestream.playback_url)
												}
											>
												Copy
											</Button>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Session Summary Card */}
				{sessionSummary?.summary && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Brain className="h-5 w-5" />
								Meeting Summary
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="prose prose-sm max-w-none">
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{sessionSummary.summary}
								</p>
								{sessionSummary.action_items &&
									sessionSummary.action_items.length > 0 && (
										<div className="mt-4">
											<h4 className="text-sm font-semibold mb-2">
												Action Items:
											</h4>
											<ul className="list-disc list-inside space-y-1">
												{sessionSummary.action_items.map((item: string) => (
													<li key={item} className="text-sm">
														{item}
													</li>
												))}
											</ul>
										</div>
									)}
							</div>
							{(sessionSummary.chat_available ||
								sessionSummary.transcript_available) && (
								<div className="flex gap-2 mt-4">
									{sessionSummary.chat_available && (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												session?.id &&
												window.open(
													`/api/sessions/${session.id}/chat`,
													"_blank",
												)
											}
										>
											<MessageSquare className="mr-1 h-3 w-3" />
											Download Chat
										</Button>
									)}
									{sessionSummary.transcript_available && (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												session?.id &&
												window.open(
													`/api/sessions/${session.id}/transcript`,
													"_blank",
												)
											}
										>
											<FileText className="mr-1 h-3 w-3" />
											Download Transcript
										</Button>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* Persisted Chat Messages Card */}
				{meeting.persist_chat &&
					chatMessages?.messages &&
					chatMessages.messages.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MessageSquare className="h-5 w-5" />
									Chat History ({chatMessages.messages.length} messages)
								</CardTitle>
								{chatMessages.sessionsCount > 1 && (
									<p className="text-sm text-muted-foreground">
										From {chatMessages.sessionsCount} sessions
									</p>
								)}
							</CardHeader>
							<CardContent>
								<div className="space-y-3 max-h-96 overflow-y-auto">
									{chatMessages.messages.map(
										(
											message: {
												timestamp: string;
												participantName: string;
												message: string;
												sessionId: string;
												sessionStarted: string;
											},
											index: number,
										) => (
											<div
												key={`${message.sessionId}-${index}`}
												className="flex gap-3 p-3 bg-muted/30 rounded-lg"
											>
												<div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
													<span className="text-xs font-semibold">
														{message.participantName.charAt(0).toUpperCase()}
													</span>
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span className="text-sm font-medium">
															{message.participantName}
														</span>
														<span className="text-xs text-muted-foreground">
															{new Date(message.timestamp).toLocaleString()}
														</span>
													</div>
													<p className="text-sm text-muted-foreground break-words">
														{message.message}
													</p>
												</div>
											</div>
										),
									)}
								</div>
								<div className="flex justify-between items-center mt-4 pt-4 border-t">
									<span className="text-xs text-muted-foreground">
										Chat messages are persisted for one week
									</span>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											window.open(`/api/meetings/${id}/chat`, "_blank")
										}
									>
										<Download className="mr-1 h-3 w-3" />
										Export Chat
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

				{/* Show message when chat persistence is enabled but no messages */}
				{meeting.persist_chat &&
					(!chatMessages?.messages || chatMessages.messages.length === 0) && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MessageSquare className="h-5 w-5" />
									Chat History
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-center py-8 text-muted-foreground">
									<MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p className="text-sm">No chat history available yet</p>
									<p className="text-xs mt-1">
										Chat messages from completed meeting sessions will appear
										here
									</p>
									<p className="text-xs mt-1 text-blue-600">
										💡 Chat is only available after a meeting session ends
									</p>
								</div>
							</CardContent>
						</Card>
					)}
			</div>
		</div>
	);
}
