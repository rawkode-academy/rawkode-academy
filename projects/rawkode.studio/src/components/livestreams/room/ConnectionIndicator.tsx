import { Signal, Wifi, WifiOff } from "lucide-react";

// Connection indicator component
export function ConnectionIndicator({ status }: { status: string }) {
	return (
		<div className="w-full mb-2 flex items-center">
			<div className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs bg-sidebar-accent/20 border border-sidebar-border/20">
				<div className="flex items-center gap-1.5">
					{status === "connected" ? (
						<>
							<Wifi className="h-3 w-3 text-green-500" />
							<span className="text-green-500 font-medium">Connected</span>
						</>
					) : status === "connecting" ? (
						<>
							<Signal className="h-3 w-3 text-amber-500 animate-pulse" />
							<span className="text-amber-500 font-medium">Connecting...</span>
						</>
					) : (
						<>
							<WifiOff className="h-3 w-3 text-red-500" />
							<span className="text-red-500 font-medium">Disconnected</span>
						</>
					)}
				</div>
				<div className="flex items-center gap-1">
					{status === "connected" && (
						<span className="inline-block w-2 h-2 rounded-full bg-green-500" />
					)}
					{status === "connecting" && (
						<span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
					)}
					{status === "disconnected" && (
						<span className="inline-block w-2 h-2 rounded-full bg-red-500" />
					)}
				</div>
			</div>
		</div>
	);
}
