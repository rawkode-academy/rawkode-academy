import { intervalToDuration } from "date-fns";

export function calculateDuration(
  startedAt: Date | null,
  finishedAt: Date | null,
): string {
  if (!startedAt || !finishedAt) {
    return "-";
  }

  try {
    const duration = intervalToDuration({
      start: new Date(startedAt),
      end: new Date(finishedAt),
    });

    // Format the duration in a human-readable way
    const parts = [];

    if (duration.days && duration.days > 0) {
      parts.push(`${duration.days}d`);
    }
    if (duration.hours && duration.hours > 0) {
      parts.push(`${duration.hours}h`);
    }
    if (duration.minutes && duration.minutes > 0) {
      parts.push(`${duration.minutes}m`);
    }
    if (duration.seconds && duration.seconds > 0) {
      parts.push(`${duration.seconds}s`);
    }

    return parts.length > 0 ? parts.join(" ") : "0s";
  } catch {
    return "-";
  }
}
