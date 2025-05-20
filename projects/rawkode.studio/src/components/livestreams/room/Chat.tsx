import { Button } from "@/components/shadcn/button";
import {
	useChat,
	useLocalParticipant,
	useRoomContext,
} from "@livekit/components-react";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Chat Section Component using LiveKit's useChat hook
interface ChatProps {
	token: string | null;
}

export function Chat({ token }: ChatProps) {
	const { chatMessages, send } = useChat();
	const [messageText, setMessageText] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const room = useRoomContext();
	const localParticipant = useLocalParticipant();

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	const handleSendMessage = async () => {
		if (messageText.trim() && send) {
			const currentMessage = messageText;
			setMessageText(""); // Clear input immediately

			try {
				// Send LiveKit message
				await send(currentMessage);

				const roomId = await room.getSid();

				const participantName = localParticipant.localParticipant.identity;
				// Call the API endpoint
				if (token && roomId && participantName) {
					await fetch("/api/livestream/chat", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							roomId: roomId,
							message: currentMessage,
							token: token,
							participantName: participantName,
						}),
					});
				} else {
					console.error(
						"Token or Room ID or Participant Name is missing, cannot send chat to API",
					);
				}
			} catch (error) {
				// Optionally, restore messageText if send failed
				// setMessageText(currentMessage);
			}
		}
	};

	return (
		<div className="flex flex-col h-full min-h-0">
			<h4 className="text-sm font-medium mb-3 flex items-center flex-shrink-0">
				<MessageSquare className="h-4 w-4 mr-2" />
				Chat
			</h4>

			<div
				className="flex-1 overflow-y-auto pr-1 mb-3 rounded-md bg-sidebar-accent/30 border border-sidebar-border/20 min-h-0"
				style={{ scrollbarWidth: "thin" }}
			>
				<div className="p-3">
					{chatMessages.length === 0 ? (
						<div className="text-xs text-sidebar-foreground/50 text-center py-2">
							No messages yet
						</div>
					) : (
						<div>
							{chatMessages.map((msg) => (
								<div key={msg.id} className="mb-3 last:mb-1">
									<div className="text-xs font-medium text-sidebar-foreground/80">
										{msg.from?.name || msg.from?.identity || "Anonymous"}
									</div>
									<div className="text-sm mt-1 break-words">{msg.message}</div>
								</div>
							))}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>
			</div>

			<div className="flex gap-2 flex-shrink-0 mt-auto">
				<input
					type="text"
					className="flex-1 h-9 px-3 py-2 text-sm bg-sidebar-accent/30 border border-sidebar-border/30 rounded-md"
					placeholder="Send a message..."
					value={messageText}
					onChange={(e) => setMessageText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							handleSendMessage();
						}
					}}
				/>
				<Button
					size="sm"
					className="h-9 flex-shrink-0"
					onClick={handleSendMessage}
				>
					Send
				</Button>
			</div>
		</div>
	);
}
