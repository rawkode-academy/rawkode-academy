import { type ClassValue, clsx } from "clsx";
import { intervalToDuration } from "date-fns";
import { nanoid } from "nanoid";
import { twMerge } from "tailwind-merge";

// ============================================
// Class name utilities
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Duration utilities
// ============================================

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

// ============================================
// Room ID generation
// ============================================

/**
 * Generates a unique room ID using nanoid
 * Returns a URL-safe unique identifier (10 characters)
 */
export function generateRoomId(): string {
  return nanoid(10);
}

// ============================================
// Guest name generation
// ============================================

export const generateGuestName = () => {
  // Use crypto API for better randomness
  const array = new Uint8Array(5);
  crypto.getRandomValues(array);

  // Convert to digits (0-9)
  const randomNumbers = Array.from(array)
    .map((byte) => byte % 10)
    .join("");

  return `guest-${randomNumbers}`;
};
