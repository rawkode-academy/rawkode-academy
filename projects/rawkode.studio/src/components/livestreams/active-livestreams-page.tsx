import { actions } from "astro:actions";
import { Button } from "@/components/shadcn/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Rocket, Video } from "lucide-react";
import * as randomWords from "random-words";
import { useEffect, useRef, useState } from "react";
import { DataTable } from "../common/DataTable";
import { ErrorMessage } from "../common/ErrorMessage";
import { Spinner } from "../common/Spinner";
import CreateLivestreamsDialog from "./create-livestreams-dialog";
import type { CreateLivestreamsDialogRef } from "./create-livestreams-dialog";
import DeleteLivestreamDialog from "./delete-livestream-dialog";
import InviteLivestreamDialog from "./invite-livestream-dialog";

type Room = {
	id: string;
	name: string;
	numParticipants: number;
};

const columns: ColumnDef<Room>[] = [
	{
		header: "ID",
		accessorFn: (row) => row.id,
	},
	{
		header: "Name",
		accessorFn: (row) => row.name,
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
					<InviteLivestreamDialog roomName={row.original.name} />
					<DeleteLivestreamDialog name={row.original.name} />
				</div>
			);
		},
	},
];

function generateInviteLink(roomName: string) {
	return `${window.location.origin}/invite/${roomName}`;
}

export default function ActiveLivestreamPage() {
	const { isPending, isError, data, error, refetch } = useQuery({
		queryKey: ["livestreams"],
		queryFn: async () => {
			const { data, error } = await actions.listRooms();
			if (error) throw error;
			return data;
		},
	});

	const [isCreating, setIsCreating] = useState(false);
	const [creationStatus, setCreationStatus] = useState<
		"idle" | "creating" | "verifying" | "complete"
	>("idle");
	const [createError, setCreateError] = useState<string | null>(null);
	const [roomName, setRoomName] = useState<string | null>(null);
	const [showDialog, setShowDialog] = useState(false);
	const [copied, setCopied] = useState(false);
	const createDialogRef = useRef<CreateLivestreamsDialogRef>(null);
	const createdRoomNameRef = useRef<string | null>(null);

	// Room verification query
	const verificationQuery = useQuery({
		queryKey: ["roomCreationVerification", createdRoomNameRef.current],
		queryFn: async () => {
			if (!createdRoomNameRef.current) {
				throw new Error("No room name to verify");
			}

			// Get fresh list of rooms from API
			const { data: freshRooms, error } = await actions.listRooms();

			if (error) throw error;
			if (!freshRooms) throw new Error("No data received");

			// Check if room exists in the list
			const roomExists = freshRooms.some(
				(room) => room.name === createdRoomNameRef.current,
			);

			// If room doesn't exist yet, throw error to trigger retry
			if (!roomExists) {
				throw new Error("Room not found yet");
			}

			// Return the room name that was verified
			return createdRoomNameRef.current;
		},
		enabled:
			creationStatus === "verifying" && createdRoomNameRef.current !== null,
		refetchInterval: 1000,
		refetchOnWindowFocus: false,
		staleTime: 0,
		retry: 10,
		retryDelay: 1000,
	});

	// Handle successful room verification
	useEffect(() => {
		if (verificationQuery.isSuccess && creationStatus === "verifying") {
			setIsCreating(false);
			setCreationStatus("complete");
			// Set room name from verification to ensure we have the latest
			setRoomName(verificationQuery.data);
			setShowDialog(true);
			createdRoomNameRef.current = null;

			// Refresh the room list
			refetch();
		}
	}, [
		verificationQuery.isSuccess,
		creationStatus,
		verificationQuery.data,
		refetch,
	]);

	// Handle max retries reached
	useEffect(() => {
		if (
			verificationQuery.failureCount >= 10 &&
			creationStatus === "verifying"
		) {
			setCreateError(
				"Room creation took longer than expected. The room may still be creating.",
			);
			setIsCreating(false);
			setCreationStatus("idle");
		}
	}, [verificationQuery.failureCount, creationStatus]);

	const copyToClipboard = async () => {
		if (!roomName) return;
		try {
			await navigator.clipboard.writeText(generateInviteLink(roomName));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy: ", err);
		}
	};

	const createRoom = async () => {
		setIsCreating(true);
		setCreationStatus("creating");
		setCreateError(null);

		try {
			// Generate 4 random words and join them with dashes
			const words = randomWords.generate({ exactly: 4 }) as string[];
			const newRoomName = words.join("-");

			// Store the created room name for verification
			createdRoomNameRef.current = newRoomName;

			const response = await actions.createRoom({
				name: newRoomName,
				maxParticipants: 10,
				emptyTimeout: 120, // 2 minutes timeout
			});

			if (response.error) {
				throw new Error(response.error.message || "Failed to create room");
			}

			// Move to verification stage
			setCreationStatus("verifying");
		} catch (err) {
			console.error("Error creating room:", err);
			setCreateError(
				err instanceof Error ? err.message : "Failed to create room",
			);
			setIsCreating(false);
			setCreationStatus("idle");
			createdRoomNameRef.current = null;
		}
	};

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
							Instant Stream
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
