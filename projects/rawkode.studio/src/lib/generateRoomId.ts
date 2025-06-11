import { nanoid } from "nanoid";

/**
 * Generates a unique room ID using nanoid
 * Returns a URL-safe unique identifier (10 characters)
 */
export function generateRoomId(): string {
  return nanoid(10);
}
