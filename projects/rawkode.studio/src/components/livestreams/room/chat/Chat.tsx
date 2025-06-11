import { useRoomPermissions } from "@/components/livestreams/room/hooks/useRoomPermissions";
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
} from "@/components/ui/EmojiPicker";
import { useChat, useRoomContext } from "@livekit/components-react";
import { MessageSquare, Send, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Chat Section Component using LiveKit's useChat hook
interface ChatProps {
  token: string | null;
}

export function Chat({ token }: ChatProps) {
  const { chatMessages, send } = useChat();
  const [messageText, setMessageText] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const room = useRoomContext();
  const permissions = useRoomPermissions();

  // Auto-scroll to top when new messages arrive
  useEffect(() => {
    // Scroll to top whenever messages change
    if (messagesContainerRef.current && chatMessages.length > 0) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [chatMessages.length]);

  const handleSendMessage = async () => {
    if (messageText.trim() && send && permissions.canSendChatMessages) {
      const processedMessage = messageText.trim();
      setMessageText(""); // Clear input immediately

      try {
        // Send LiveKit message
        await send(processedMessage);

        // Call the API endpoint
        if (token) {
          await fetch("/api/livestream/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              roomName: room.name,
              participantName:
                room.localParticipant?.name ||
                room.localParticipant?.identity ||
                "Anonymous",
              participantIdentity:
                room.localParticipant?.identity || "anonymous",
              message: processedMessage,
            }),
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      const text = messageText;
      const newText = text.slice(0, start) + emoji + text.slice(end);
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
    <div className="flex flex-col h-full min-h-0 p-2">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto pr-2 mb-3 min-h-0 custom-scrollbar"
      >
        <div>
          {chatMessages.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No messages yet
            </div>
          ) : (
            <div>
              {[...chatMessages].reverse().map((msg) => (
                <div
                  key={msg.id}
                  className="mb-3 last:mb-1 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium text-primary">
                    {msg.from?.name || msg.from?.identity || "Anonymous"}
                  </div>
                  <div className="text-sm mt-0.5 text-foreground break-words">
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {permissions.canSendChatMessages ? (
        <div className="flex gap-2 flex-shrink-0 mt-auto">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-0 h-10 px-3 py-2 text-sm bg-background/80 backdrop-blur-sm border border-border rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-foreground placeholder-muted-foreground"
            placeholder="Type a message..."
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
                className="h-10 w-10 p-0 hover:bg-accent rounded-xl border border-border flex-shrink-0"
                title="Add emoji"
              >
                <Smile className="h-4 w-4 text-foreground" />
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
                <EmojiPickerFooter className="text-xs" />
              </EmojiPicker>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            className="h-10 w-10 p-0 rounded-xl font-medium flex-shrink-0"
            onClick={handleSendMessage}
            disabled={!send || messageText.trim().length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-2 flex-shrink-0">
          {permissions.role === "viewer"
            ? "Viewers cannot send messages"
            : "You don't have permission to send messages"}
        </div>
      )}
    </div>
  );
}
