import { Spinner } from "@/components/common/Spinner";
import CreateLivestreamsDialog from "@/components/livestreams/dialogs/CreateLivestreamDialog";
import type { CreateLivestreamsDialogRef } from "@/components/livestreams/dialogs/CreateLivestreamDialog";
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
import { Copy, ExternalLink, Rocket, Video } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";

function generateInviteLink(roomName: string) {
	return `${window.location.origin}/watch/${roomName}`;
}

interface Props {
	user?: { roles?: string[] };
}

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

	const handleJoinAsDirector = () => {
		if (!roomName) return;
		window.open(`/watch/${roomName}`, "_blank");
	};

	const openCustomStreamDialog = () => {
		if (createDialogRef.current) {
			createDialogRef.current.setOpen(true);
		}
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
			{!user?.roles?.includes("director") && (
				<div className="mt-10 max-w-2xl mx-auto">
					<div className="rounded-lg border bg-card p-8 text-center">
						<Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h2 className="text-xl font-semibold mb-2">
							Live Streams Coming Soon
						</h2>
						<p className="text-muted-foreground mb-4">
							We're working on bringing you a list of upcoming and active
							livestreams. Check back soon or ask your host for a direct link to
							join a stream.
						</p>
						<p className="text-sm text-muted-foreground">
							In the meantime, if you have a link to a livestream, you can join
							it directly.
						</p>
					</div>
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
