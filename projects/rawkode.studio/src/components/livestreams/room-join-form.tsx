import { useEffect, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { actions } from "astro:actions";
import { Spinner } from "../common/Spinner";
import { User } from "lucide-react";

interface Props {
  roomName: string;
  skipRoomCheck?: boolean;
}

export default function RoomJoinForm(
  { roomName, skipRoomCheck = false }: Props,
) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(!skipRoomCheck);
  const [roomExists, setRoomExists] = useState(true);

  // Check if the room exists when component mounts
  useEffect(() => {
    // Skip the check if skipRoomCheck is true
    if (skipRoomCheck) {
      setIsCheckingRoom(false);
      return;
    }

    const checkRoomExists = async () => {
      try {
        setIsCheckingRoom(true);
        const response = await actions.listRooms();

        if (response.error) {
          console.error("Error checking rooms:", response.error);
          setRoomExists(true); // Assume it exists if we can't check
        } else if (Array.isArray(response.data)) {
          const exists = response.data.some((room: any) =>
            room.name === roomName
          );
          setRoomExists(exists);
        }
      } catch (err) {
        console.error("Failed to check if room exists:", err);
        setRoomExists(true); // Assume it exists if we can't check
      } finally {
        setIsCheckingRoom(false);
      }
    };

    checkRoomExists();
  }, [roomName, skipRoomCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Skip room existence check if skipRoomCheck is true
    if (!skipRoomCheck) {
      try {
        // Double check if room still exists
        const roomsResponse = await actions.listRooms();

        if (!roomsResponse.error && Array.isArray(roomsResponse.data)) {
          const roomStillExists = roomsResponse.data.some((room: any) =>
            room.name === roomName
          );

          if (!roomStillExists) {
            throw new Error(
              "This livestream has ended or is no longer available",
            );
          }
        }
      } catch (err) {
        console.error("Error checking room:", err);
        // Continue anyway since we've already checked on the server side
      }
    }

    try {
      const response = await actions.generateTokenFromInvite({
        roomName,
        participantName: name.trim() || undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate token");
      }

      // The data itself is the token string now
      if (typeof response.data === "string") {
        // Store the token in sessionStorage
        sessionStorage.setItem("livekit-token", response.data);
        sessionStorage.setItem("livekit-room", roomName);

        console.log("Token generated and stored in sessionStorage");

        // Notify the LivekitRoom component to refresh its tokens
        document.dispatchEvent(new CustomEvent("livekit-refresh-tokens"));

        // Hide this component and show success message
        const formContainer = document.querySelector("form")?.closest(
          ".space-y-6",
        );
        if (formContainer) {
          // Create success message
          const successMessage = document.createElement("div");
          successMessage.className =
            "p-4 border border-green-300 bg-green-50 text-green-700 rounded-lg flex items-center gap-3";
          successMessage.innerHTML = `
            <div class="shrink-0 size-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12l5 5 5-5"/><path d="M12 2v15"/></svg>
            </div>
            <div>
              <p class="font-medium">Joining Stream</p>
              <p class="text-sm text-green-600">
                Connecting as ${name.trim() || "Guest"}...
              </p>
            </div>
          `;

          // Replace form with success message
          formContainer.innerHTML = "";
          formContainer.appendChild(successMessage);
        }

        // Trigger the join event directly - this will cause the room-manager component to handle the join
        setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent("initiate-join", {
              detail: { roomName },
            }),
          );
        }, 500);
      } else {
        throw new Error("Invalid token returned from server");
      }
    } catch (err) {
      console.error("Error joining room:", err);
      setError(err instanceof Error ? err.message : "Failed to join room");
      setIsLoading(false);
    }
  };

  if (isCheckingRoom) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!roomExists && !skipRoomCheck) {
    return (
      <div className="p-4 border border-destructive/20 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3">
        <div>
          <p className="font-medium">Room Not Available</p>
          <p className="text-sm opacity-80">
            This livestream has ended or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Your Display Name
          </Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <User className="size-4" />
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name (optional)"
              className="pl-9"
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This is how others will see you in the livestream
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full gap-2"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? <Spinner className="size-4" /> : null}
          Join Livestream
        </Button>
      </form>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-center text-muted-foreground">
          By joining, you agree to our terms of service and community guidelines
        </p>
      </div>
    </div>
  );
}
