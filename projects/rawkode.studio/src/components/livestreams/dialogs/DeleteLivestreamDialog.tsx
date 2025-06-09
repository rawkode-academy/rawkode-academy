import { actions } from "astro:actions";
import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/shadcn/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRef } from "react";

interface Props {
	name: string;
}

export default function DeleteLivestreamDialog({ name }: Props) {
	// Dialog state
	const [isOpen, setIsOpen] = useState(false);

	// Deletion state
	const [isDeleting, setIsDeleting] = useState(false);
	const [isError, setIsError] = useState(false);

	// Reference to current room being deleted
	const roomToDeleteRef = useRef<string | null>(null);

	// Query client for cache invalidation
	const queryClient = useQueryClient();

	// Verification query with built-in polling
	const verificationQuery = useQuery({
		queryKey: ["roomDeletionVerification", roomToDeleteRef.current],
		queryFn: async () => {
			// Get fresh list of rooms directly from API
			const { data: rooms, error } = await actions.rooms.listRooms();

			if (error) throw error;
			if (!rooms) throw new Error("No data received");

			// Check if the room still exists
			const stillExists = rooms.some(
				(room) => room.name === roomToDeleteRef.current,
			);

			// If room still exists, throw error to trigger retry
			if (stillExists) {
				throw new Error("Room still exists");
			}

			// Return true if room is gone (success)
			return true;
		},
		enabled: isDeleting && roomToDeleteRef.current !== null,
		refetchInterval: 1500,
		refetchOnWindowFocus: false,
		staleTime: 0,
		retry: 20,
		retryDelay: 1500,
	});

	// Handle successful verification
	useEffect(() => {
		if (verificationQuery.isSuccess && isDeleting) {
			queryClient.invalidateQueries({ queryKey: ["livestreams"] });
			setIsDeleting(false);
			setIsOpen(false);
			roomToDeleteRef.current = null;
		}
	}, [verificationQuery.isSuccess, isDeleting, queryClient]);

	// Handle max retries reached
	useEffect(() => {
		if (verificationQuery.failureCount >= 20 && isDeleting) {
			setIsDeleting(false);
			setIsError(true);
			roomToDeleteRef.current = null;
		}
	}, [verificationQuery.failureCount, isDeleting]);

	// Delete the room
	const deleteRoom = async () => {
		try {
			// Start deleting
			setIsDeleting(true);
			setIsError(false);
			roomToDeleteRef.current = name;

			// Call API to delete room
			await actions.rooms.deleteRoom({ name });

			// API call success, verification will happen automatically
			// through the enabled query
		} catch (error) {
			setIsDeleting(false);
			setIsError(true);
			roomToDeleteRef.current = null;
		}
	};

	// Reset all state
	const handleClose = () => {
		if (!isDeleting) {
			setIsOpen(false);
			setIsError(false);
			roomToDeleteRef.current = null;
		}
	};

	return (
		<>
			{/* Trigger Button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<div>
						<Button
							size="icon"
							variant="outline"
							onClick={() => setIsOpen(true)}
						>
							<Trash />
						</Button>
					</div>
				</TooltipTrigger>
				<TooltipContent>Delete Live Stream "{name}"</TooltipContent>
			</Tooltip>

			{/* Delete Dialog */}
			<Dialog
				open={isOpen}
				onOpenChange={(open) => {
					// Only allow closing if not deleting
					if (!open && isDeleting) return;
					setIsOpen(open);
					if (!open) handleClose();
				}}
			>
				<DialogContent className="sm:max-w-lg">
					{isDeleting && (
						<motion.div
							className="absolute inset-x-0 top-0 h-1 bg-destructive z-50 origin-left"
							initial={{ scaleX: 0 }}
							animate={{
								scaleX:
									verificationQuery.fetchStatus === "fetching" ? 0.85 : 0.4,
								transition: { duration: 2, ease: "easeOut" },
							}}
						/>
					)}

					{/* Custom close button that's disabled during deletion */}
					<DialogClose
						className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
						disabled={isDeleting}
					>
						<X className="h-4 w-4" />
						<span className="sr-only">Close</span>
					</DialogClose>

					<DialogHeader>
						<DialogTitle>Delete Live Stream "{name}"?</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>

					{!isDeleting && isError && (
						<div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm mb-4">
							Failed to delete room. It may still exist.
						</div>
					)}

					<div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={handleClose}
								disabled={isDeleting}
							>
								Cancel
							</Button>
							<div>
								<Button
									variant={isError ? "outline" : "destructive"}
									onClick={deleteRoom}
									disabled={isDeleting}
								>
									{isDeleting ? (
										<>
											<Spinner size="small" className="mr-1 h-4 w-4" />
											Deleting...
										</>
									) : (
										"Delete"
									)}
								</Button>
							</div>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
