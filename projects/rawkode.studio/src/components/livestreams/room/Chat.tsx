import { Button } from "@/components/shadcn/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/shadcn/popover";
import {
	EmojiPicker,
	EmojiPickerContent,
	EmojiPickerFooter,
	EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import { useChat, useRoomContext } from "@livekit/components-react";
import { MessageSquare, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Chat Section Component using LiveKit's useChat hook
interface ChatProps {
	token: string | null;
}

export function Chat({ token }: ChatProps) {
	const { chatMessages, send } = useChat();
	const [messageText, setMessageText] = useState("");
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const room = useRoomContext();

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	const handleSendMessage = async () => {
		if (messageText.trim() && send) {
			const processedMessage = messageText.trim();
			setMessageText(""); // Clear input immediately

			try {
				// Send LiveKit message
				await send(processedMessage);

				const roomSid = await room.getSid();

				// Call the API endpoint
				if (token && roomSid) {
					await fetch("/api/livestream/chat", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							roomSid: roomSid,
							message: processedMessage,
						}),
					});
				} else {
					console.error(
						"Token or Room SID is missing, cannot send chat to API",
					);
				}
			} catch (error) {
				// Optionally, restore messageText if send failed
				// setMessageText(currentMessage);
			}
		}
	};

	const handleEmojiSelect = (emoji: string) => {
		// Insert emoji at cursor position or at the end
		if (inputRef.current) {
			const start = inputRef.current.selectionStart || messageText.length;
			const end = inputRef.current.selectionEnd || messageText.length;
			const newText =
				messageText.slice(0, start) + emoji + messageText.slice(end);
			setMessageText(newText);

			// Focus back on input and set cursor position after emoji
			setTimeout(() => {
				inputRef.current?.focus();
				const newCursorPos = start + emoji.length;
				inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
			}, 0);
		}
		setEmojiPickerOpen(false);
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
				<div className="flex-1 relative flex gap-1">
					<input
						ref={inputRef}
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
					<Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
						<PopoverTrigger asChild>
							<Button
								size="sm"
								variant="ghost"
								className="h-9 w-9 p-0"
								title="Add emoji"
							>
								<Smile className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="p-0 w-[320px] overflow-hidden"
							align="end"
						>
							<EmojiPicker
								className="h-[350px] w-full"
								onEmojiSelect={(emoji) => handleEmojiSelect(emoji.emoji)}
							>
								<EmojiPickerSearch placeholder="Search emoji..." />
								<EmojiPickerContent className="h-[250px]" />
								<EmojiPickerFooter />
							</EmojiPicker>
						</PopoverContent>
					</Popover>
				</div>
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
