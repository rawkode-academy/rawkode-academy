import { RaisedHandsList } from "@/components/livestreams/room/RaisedHandsList";
import { RoomControls } from "@/components/livestreams/room/RoomControls";
import { Separator } from "@/components/shadcn/separator";

interface ControlsSectionProps {
	token: string | null;
}

export function ControlsSection({ token }: ControlsSectionProps) {
	return (
		<div className="space-y-4">
			<RoomControls token={token} />
			<RaisedHandsList token={token} />
			<Separator />
		</div>
	);
}
