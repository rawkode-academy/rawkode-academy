import { MonitorSpeaker } from "lucide-react";

export function EmptyState() {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <div className="text-center p-6 sm:p-8 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-md shadow-sm w-full max-w-xs sm:max-w-sm md:max-w-md border border-gray-300/20 dark:border-white/10">
        <div className="p-3 sm:p-4 bg-black/5 dark:bg-white/5 rounded-lg w-fit mx-auto mb-4">
          <MonitorSpeaker className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No active media
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
          Waiting for participants to share their screen or camera
        </p>
      </div>
    </div>
  );
}
