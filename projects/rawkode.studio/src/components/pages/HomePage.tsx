import { actions } from "astro:actions";
import { Clock, Copy, ExternalLink, Rocket, Users, Video } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import type { CreateLivestreamsDialogRef } from "@/components/livestreams/dialogs/CreateLivestreamDialog";
import CreateLivestreamsDialog from "@/components/livestreams/dialogs/CreateLivestreamDialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useRoomCreation } from "@/hooks/useRoomCreation";

function generateInviteLink(roomName: string) {
  return `${window.location.origin}/watch/${roomName}`;
}

interface Props {
  user?: { roles?: string[] };
}

type RunningLivestream = {
  id: string;
  displayName: string;
  participantCount: number;
  startedAt: Date | null;
};

export default function HomePage({ user }: Props) {
  const {
    isCreating,
    creationStatus,
    createError,
    roomName,
    createRoom,
    showDialog,
    setShowDialog,
    copied,
    copyToClipboard,
  } = useRoomCreation();

  const createDialogRef = useRef<CreateLivestreamsDialogRef>(null);
  const [runningLivestreams, setRunningLivestreams] = useState<
    RunningLivestream[]
  >([]);
  const [isLoadingLivestreams, setIsLoadingLivestreams] = useState(false);

  const fetchRunningLivestreams = useCallback(async () => {
    setIsLoadingLivestreams(true);
    try {
      const result = await actions.rooms.listRunningRooms();
      if (result.data) {
        setRunningLivestreams(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch running livestreams:", error);
    } finally {
      setIsLoadingLivestreams(false);
    }
  }, []);

  // Fetch running livestreams for all non-director users
  useEffect(() => {
    if (!user?.roles?.includes("director")) {
      fetchRunningLivestreams();
    }
  }, [user, fetchRunningLivestreams]);

  const handleJoinAsDirector = () => {
    if (!roomName) return;
    window.open(`/watch/${roomName}`, "_blank");
  };

  const openCustomStreamDialog = () => {
    if (createDialogRef.current) {
      createDialogRef.current.setOpen(true);
    }
  };

  const formatStartTime = (startedAt: Date | null) => {
    if (!startedAt) return "N/A";
    return new Date(startedAt).toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Progress indicator */}
      {isCreating && (
        <motion.div
          className="fixed inset-x-0 top-0 h-1 bg-primary z-50"
          initial={{ width: "0%" }}
          animate={{
            width: creationStatus === "verifying" ? "80%" : "40%",
            transition: { duration: 1.5, ease: "easeOut" },
          }}
        />
      )}

      {/* Hero section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          {user?.roles?.includes("director")
            ? "Live Streaming"
            : "Welcome to RawkodeStudio"}
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          {user?.roles?.includes("director")
            ? "Quickly create and manage live streams for your audience."
            : "Watch live streams and engage with the community."}
        </p>
      </div>

      {/* CTA buttons - only show for directors */}
      {user?.roles?.includes("director") && (
        <div className="mt-10 flex flex-col gap-y-4 sm:flex-row sm:gap-x-6 sm:gap-y-0 justify-center">
          <Button
            onClick={createRoom}
            disabled={isCreating}
            className="gap-2 overflow-hidden relative"
            size="lg"
          >
            <div className="flex items-center gap-2">
              {isCreating ? (
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                >
                  <Spinner className="h-5 w-5" />
                </motion.div>
              ) : (
                <Rocket className="h-5 w-5" />
              )}
              Start Instant Stream
            </div>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={openCustomStreamDialog}
          >
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Create Custom Stream
            </div>
          </Button>
        </div>
      )}

      {/* Viewer content - show when not a director */}
      {!user?.roles?.includes("director") && user && (
        <div className="mt-10 max-w-4xl mx-auto">
          {isLoadingLivestreams ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : runningLivestreams.length > 0 ? (
            <div>
              <h2 className="text-2xl font-semibold mb-6 text-center">
                Active Livestreams
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {runningLivestreams.map((livestream) => (
                  <Card key={livestream.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {livestream.displayName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {livestream.participantCount}{" "}
                                {livestream.participantCount === 1
                                  ? "participant"
                                  : "participants"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                Started: {formatStartTime(livestream.startedAt)}
                              </span>
                            </div>
                          </CardDescription>
                        </div>
                        <Badge variant="default" className="bg-green-500">
                          Live
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() =>
                          window.open(`/watch/${livestream.id}`, "_blank")
                        }
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Join Livestream
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                No Active Livestreams
              </h2>
              <p className="text-muted-foreground mb-4">
                There are no livestreams running at the moment. Check back later
                or ask your host for a direct link to join a stream.
              </p>
            </div>
          )}
        </div>
      )}

      {createError && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm max-w-xl mx-auto">
          {createError}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <div>
            <DialogHeader>
              <DialogTitle>Room Created Successfully!</DialogTitle>
              <DialogDescription>
                Share this link to invite people to your livestream
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <div className="flex items-center space-x-2">
                <Input
                  value={roomName ? generateInviteLink(roomName) : ""}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={copyToClipboard}
                  variant="secondary"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              {copied && (
                <p className="mt-2 text-sm text-green-500">
                  Copied to clipboard!
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button onClick={() => setShowDialog(false)} variant="outline">
                  Close
                </Button>
                <div>
                  <Button onClick={handleJoinAsDirector} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Join Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden dialog for custom stream creation */}
      <CreateLivestreamsDialog ref={createDialogRef} hideTrigger={true} />
    </div>
  );
}
