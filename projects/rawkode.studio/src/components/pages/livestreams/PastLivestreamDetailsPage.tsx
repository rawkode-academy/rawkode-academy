import { actions } from "astro:actions";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router";
import type { ChatMessage } from "@/actions/chat";
import type { Participant } from "@/actions/participants";
import type { PastLiveStream } from "@/actions/rooms";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { Badge } from "@/components/shadcn/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { calculateDuration } from "@/lib/utils";

export default function PastLivestreamDetailsPage() {
  const { roomId } = useParams<{ roomId: string }>();

  const {
    isPending: roomDetailsPending,
    isError: roomDetailsError,
    data: roomDetails,
    error: roomDetailsFetchError,
  } = useQuery({
    queryKey: ["pastLivestreamDetails", roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const { data, error } = await actions.rooms.listPastRooms();
      if (error) throw error;
      return (
        (data as PastLiveStream[]).find((room) => room.id === roomId) || null
      );
    },
    enabled: !!roomId,
  });

  const {
    isPending: chatPending,
    isError: chatError,
    data: chatMessages,
    error: chatFetchError,
  } = useQuery({
    queryKey: ["pastLivestreamChatMessages", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await actions.chat.getPastRoomChatMessages({
        roomId,
      });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!roomId,
  });

  const {
    isPending: participantsPending,
    isError: participantsError,
    data: participants,
    error: participantsFetchError,
  } = useQuery({
    queryKey: ["roomParticipants", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await actions.participants.getRoomParticipants({
        roomId,
      });
      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!roomId,
  });

  const isPending = roomDetailsPending || chatPending || participantsPending;
  const isError = roomDetailsError || chatError || participantsError;
  const errorToDisplay =
    roomDetailsFetchError || chatFetchError || participantsFetchError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6"
    >
      <div className="mb-4">
        <Link
          to="/livestreams/past"
          className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        >
          &larr; Back to Past Livestreams
        </Link>
      </div>
      {roomDetails && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">
              {roomDetails.displayName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">LiveKit SID</p>
                <p className="font-mono text-sm truncate">
                  {roomDetails.livekitSid}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Room ID</p>
                <p className="font-mono text-sm">{roomDetails.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="secondary">Ended</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Started At</p>
                <p className="text-sm">
                  {roomDetails.startedAt
                    ? new Date(roomDetails.startedAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finished At</p>
                <p className="text-sm">
                  {roomDetails.finishedAt
                    ? new Date(roomDetails.finishedAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-sm">
                  {calculateDuration(
                    roomDetails.startedAt,
                    roomDetails.finishedAt,
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">
        Chat History
      </h2>

      {isPending && (
        <div className="flex items-center justify-center h-64">
          <Spinner className="size-10 text-blue-500" />
        </div>
      )}

      {isError && errorToDisplay && <ErrorMessage error={errorToDisplay} />}

      {!isPending && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg max-h-[70vh] overflow-y-auto">
            {chatMessages && chatMessages.length > 0 ? (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col p-3 bg-white dark:bg-neutral-700 rounded-md"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-neutral-600 dark:text-neutral-300">
                      {msg.participantName}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-200 text-sm">
                    {msg.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">
                No chat messages found for this livestream.
              </p>
            )}
          </div>

          {participants && participants.length > 0 ? (
            <div className="md:col-span-1 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg max-h-[70vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-3 text-neutral-700 dark:text-neutral-300">
                Participants ({participants.length})
              </h2>
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li
                    key={participant.id} // Assuming participant has an id
                    className="p-2 bg-white dark:bg-neutral-700 rounded text-sm text-neutral-600 dark:text-neutral-300"
                  >
                    {participant.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="md:col-span-1 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
              <p className="text-neutral-500 dark:text-neutral-400">
                No participants found for this livestream.
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
