import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowLeft,
	Brain,
	Calendar,
	Circle,
	Clock,
	Globe,
	MessageSquare,
	Monitor,
	PauseCircle,
	PlayCircle,
	Radio,
	Users,
	Video,
	Wifi,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
		enabled: !!id && meeting?.status === "ACTIVE",
		refetchInterval: 5000, // Refresh every 5 seconds
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
		enabled: !!id && meeting?.status === "ACTIVE",
		refetchInterval: 5000, // Refresh every 5 seconds
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
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle className="text-2xl">
									{meeting.title || `Meeting ${meeting.id.slice(0, 8)}`}
								</CardTitle>
								<div className="flex items-center gap-2 mt-2">
									<Badge
										variant={
											meeting.status === "ACTIVE" ? "default" : "secondary"
										}
									>
										{meeting.status || "INACTIVE"}
									</Badge>
									{meeting.preferred_region && (
										<Badge variant="outline">
											<Globe className="mr-1 h-3 w-3" />
											{meeting.preferred_region}
										</Badge>
									)}
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Calendar className="h-4 w-4" />
								Created: {new Date(meeting.created_at).toLocaleString()}
							</div>
							{meeting.updated_at && (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									Updated: {new Date(meeting.updated_at).toLocaleString()}
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Meeting Configuration</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Video className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Record on Start</span>
								</div>
								<Badge
									variant={meeting.record_on_start ? "default" : "outline"}
								>
									{meeting.record_on_start ? "Enabled" : "Disabled"}
								</Badge>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Radio className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Live Stream on Start</span>
								</div>
								<Badge
									variant={meeting.live_stream_on_start ? "default" : "outline"}
								>
									{meeting.live_stream_on_start ? "Enabled" : "Disabled"}
								</Badge>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<MessageSquare className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Persist Chat</span>
								</div>
								<Badge variant={meeting.persist_chat ? "default" : "outline"}>
									{meeting.persist_chat ? "Enabled" : "Disabled"}
								</Badge>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Brain className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Summarize on End</span>
								</div>
								<Badge
									variant={meeting.summarize_on_end ? "default" : "outline"}
								>
									{meeting.summarize_on_end ? "Enabled" : "Disabled"}
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Active Session Card */}
				{session && session.id && (
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

				{/* Recordings Card */}
				{session?.recordings && session.recordings.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Video className="h-5 w-5" />
								Recordings
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{session.recordings.map((recording: any) => (
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
												{recording.recording_duration && (
													<p className="text-xs text-muted-foreground">
														<Clock className="inline h-3 w-3 mr-1" />
														{Math.floor(recording.recording_duration / 60)}m{" "}
														{recording.recording_duration % 60}s
													</p>
												)}
											</div>
										</div>
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
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Livestream Card */}
				{livestream && livestream.id && (
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

				<Card>
					<CardHeader>
						<CardTitle>Meeting ID</CardTitle>
					</CardHeader>
					<CardContent>
						<code className="text-sm bg-muted px-2 py-1 rounded">
							{meeting.id}
						</code>
					</CardContent>
				</Card>

				<div className="flex gap-4">
					{meeting.status === "ACTIVE" && (
						<Button
							onClick={() => navigate(`/meeting/${meeting.id}`)}
							className="flex-1"
						>
							<Users className="mr-2 h-4 w-4" />
							Join Meeting
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
