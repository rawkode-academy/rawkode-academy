import { Users } from "lucide-react";

export function EmptyState() {
	return (
		<div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
			<div className="text-center p-8 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl max-w-md border border-white/10">
				<div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
					<Users className="w-12 h-12 text-gray-400" />
				</div>
				<h3 className="text-xl font-semibold text-white mb-2">
					No active video feeds
				</h3>
				<p className="text-gray-400 text-sm">
					Waiting for participants to enable their cameras
				</p>
			</div>
		</div>
	);
}
