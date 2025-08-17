import { Check, Copy, Share2, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard, generateMeetingUrl } from "@/lib/meeting-utils";
import type { Meeting } from "@/lib/realtime-kit/client";

interface ShareMeetingDialogProps {
	meeting: Meeting;
	children?: React.ReactNode;
}

export function ShareMeetingDialog({
	meeting,
	children,
}: ShareMeetingDialogProps) {
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	const meetingUrl = generateMeetingUrl(meeting.id);

	const handleCopyUrl = async () => {
		const success = await copyToClipboard(meetingUrl);
		if (success) {
			setCopiedUrl(true);
			setTimeout(() => setCopiedUrl(false), 2000);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" size="sm">
						<Share2 className="h-4 w-4 mr-2" />
						Share
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md bg-gray-800 border-gray-700">
				<DialogHeader>
					<DialogTitle className="text-white">Share Meeting</DialogTitle>
					<DialogDescription className="text-gray-400">
						Anyone with this link can join the meeting.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					{/* Meeting Info */}
					<div className="text-center">
						<h3 className="text-white font-semibold text-lg">
							{meeting.title}
						</h3>
						<div className="flex items-center justify-center space-x-4 text-sm text-gray-400 mt-2">
							<div className="flex items-center space-x-1">
								<Users className="h-4 w-4" />
								<span>Livestream Meeting</span>
							</div>
							<div className="flex items-center space-x-1">
								<span
									className={`inline-block w-2 h-2 rounded-full ${
										meeting.status === "ACTIVE" ? "bg-green-500" : "bg-gray-500"
									}`}
								/>
								<span>{meeting.status}</span>
							</div>
						</div>
					</div>

					{/* Share URL */}
					<div className="space-y-3">
						<Label className="text-white">Meeting Link</Label>
						<div className="flex space-x-2">
							<Input
								value={meetingUrl}
								readOnly
								className="bg-gray-700 border-gray-600 text-white"
							/>
							<Button
								onClick={handleCopyUrl}
								variant="outline"
								size="sm"
								className="shrink-0"
							>
								{copiedUrl ? (
									<Check className="h-4 w-4" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
						</div>
						<p className="text-xs text-gray-400">
							Share this link with anyone you want to join the meeting
						</p>
					</div>

					{/* Actions */}
					<div className="flex justify-end space-x-2 pt-2">
						<Button variant="outline" onClick={() => setIsOpen(false)}>
							Close
						</Button>
						<Button
							onClick={handleCopyUrl}
							className="bg-blue-600 hover:bg-blue-700"
						>
							{copiedUrl ? (
								<>
									<Check className="h-4 w-4 mr-2" />
									Copied!
								</>
							) : (
								<>
									<Copy className="h-4 w-4 mr-2" />
									Copy Link
								</>
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
