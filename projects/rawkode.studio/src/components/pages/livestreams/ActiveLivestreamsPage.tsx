import { actions } from "astro:actions";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Rocket, Video } from "lucide-react";
import { useRef } from "react";
import type { LiveStream } from "@/actions/rooms";
import { DataTable } from "@/components/common/DataTable";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import type { CreateLivestreamsDialogRef } from "@/components/livestreams/dialogs/CreateLivestreamDialog";
import CreateLivestreamsDialog from "@/components/livestreams/dialogs/CreateLivestreamDialog";
import DeleteLivestreamDialog from "@/components/livestreams/dialogs/DeleteLivestreamDialog";
import InviteLivestreamDialog from "@/components/livestreams/dialogs/InviteLivestreamDialog";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useRoomCreation } from "@/hooks/useRoomCreation";

const columns: ColumnDef<LiveStream>[] = [
  {
    header: "LiveKit SID",
    accessorFn: (row) => row.livekitSid,
  },
  {
    header: "Room ID",
    accessorFn: (row) => row.id,
  },
  {
    header: "Display Name",
    accessorFn: (row) => row.displayName,
  },
  {
    header: "Participants",
    accessorFn: (row) => row.numParticipants,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <div className="flex space-x-2">
          <InviteLivestreamDialog
            roomId={row.original.id}
            displayName={row.original.displayName}
          />
          <DeleteLivestreamDialog
            id={row.original.id}
            displayName={row.original.displayName}
          />
        </div>
      );
    },
  },
];

function generateInviteLink(roomName: string) {
  return `${window.location.origin}/watch/${roomName}`;
}

export default function ActiveLivestreamPage() {
  const { isPending, isError, data, error, refetch } = useQuery({
    queryKey: ["livestreams"],
    queryFn: async () => {
      const { data, error } = await actions.rooms.listRooms();
      if (error) throw error;
      return data;
    },
  });

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
  } = useRoomCreation(() => {
    // Refresh the room list when a room is created
    refetch();
  });

  const createDialogRef = useRef<CreateLivestreamsDialogRef>(null);

  const handleJoinAsDirector = () => {
    if (!roomName) return;
    window.open(`/watch/${roomName}`, "_blank");
  };

  const openCustomStreamDialog = () => {
    if (createDialogRef.current) {
      createDialogRef.current.setOpen(true);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Spinner className="size-10" />
        </motion.div>
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="space-y-6">
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

      <div className="flex justify-end items-center mb-6">
        <div className="flex gap-3">
          <Button
            size="sm"
            onClick={createRoom}
            disabled={isCreating}
            className="gap-2 overflow-hidden relative"
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
                  <Spinner className="h-4 w-4" />
                </motion.div>
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {isCreating ? "Creating..." : "Instant Stream"}
            </div>
          </Button>
          <Button size="sm" variant="outline" onClick={openCustomStreamDialog}>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Custom Stream
            </div>
          </Button>
        </div>
      </div>

      {createError && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {createError}
        </div>
      )}

      <div className="mt-8">
        <DataTable columns={columns} data={data} />
      </div>

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
