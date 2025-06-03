import RoomJoinForm from "@/components/livestreams/room/room-join-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Link, UserCheck } from "lucide-react";

interface Props {
	roomName: string;
	roomExists: boolean;
	isDirector?: boolean;
	directorName?: string;
}

export default function InviteRoomForm({
	roomName,
	roomExists,
	isDirector,
	directorName,
}: Props) {
	const handleDirectorJoin = () => {
		// Directors can join directly
		window.location.href = `/watch/${roomName}`;
	};

	return (
		<div id="join-ui" className="mt-6">
			{!roomExists && (
				<Alert variant="destructive">
					<Link className="size-5 mr-2" />
					<AlertTitle>Room Not Available</AlertTitle>
					<AlertDescription>
						This livestream may have ended or doesn't exist.
					</AlertDescription>
				</Alert>
			)}

			{roomExists && isDirector ? (
				<div className="space-y-4">
					<div className="text-center space-y-2">
						<div className="flex items-center justify-center gap-2 text-muted-foreground">
							<UserCheck className="size-5" />
							<span className="text-sm">Signed in as {directorName}</span>
						</div>
					</div>
					<Button
						onClick={handleDirectorJoin}
						className="w-full gap-2"
						size="lg"
					>
						Join as Director
					</Button>
					<div className="pt-4 border-t border-border">
						<p className="text-xs text-center text-muted-foreground">
							You have director privileges for this livestream
						</p>
					</div>
				</div>
			) : (
				roomExists && <RoomJoinForm roomName={roomName} />
			)}
		</div>
	);
}
