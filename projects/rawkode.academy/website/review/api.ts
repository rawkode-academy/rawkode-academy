export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, body.error ?? "The request failed. Try again.");
  return body as T;
}
export function timestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
