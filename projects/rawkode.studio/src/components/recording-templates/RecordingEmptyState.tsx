import { layoutStyles } from "@/lib/layout";

interface RecordingEmptyStateProps {
  message?: string;
}

export function RecordingEmptyState({
  message = "Waiting for participants...",
}: RecordingEmptyStateProps) {
  return (
    <div
      className={`${layoutStyles.container} flex items-center justify-center`}
    >
      <div className="text-gray-400 text-center">
        <p className="text-xl">{message}</p>
      </div>
    </div>
  );
}
