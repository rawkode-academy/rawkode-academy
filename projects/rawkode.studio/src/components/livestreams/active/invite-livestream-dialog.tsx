import { Button } from "@/components/shadcn/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { Copy, Link2 } from "lucide-react";
import { useState } from "react";

interface Props {
	roomName: string;
}

export default function InviteLivestreamDialog({ roomName }: Props) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const inviteLink = `${window.location.origin}/invite/${roomName}`;

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy: ", err);
		}
	};

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<div>
						<Button size="icon" variant="outline" onClick={() => setOpen(true)}>
							<Link2 />
						</Button>
					</div>
				</TooltipTrigger>
				<TooltipContent>Invite to Live Stream "{roomName}"</TooltipContent>
			</Tooltip>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<div>
						<DialogHeader>
							<DialogTitle>Invite to Live Stream</DialogTitle>
							<DialogDescription>
								Share this link to invite someone to the "{roomName}" live
								stream
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center space-x-2 mt-4">
							<Input value={inviteLink} readOnly className="flex-1" />
							<div>
								<Button
									size="icon"
									onClick={copyToClipboard}
									variant="secondary"
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
						</div>
						{copied && (
							<p className="text-sm text-green-500 mt-2">
								Copied to clipboard!
							</p>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
