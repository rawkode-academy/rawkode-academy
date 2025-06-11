import { useEffect, useState } from "react";

interface UseTokenOptions {
  roomName?: string;
  participantName?: string;
}

interface TokenResult {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useLivestreamToken({
  roomName,
  participantName,
}: UseTokenOptions): TokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomName) {
      setIsLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          roomName,
          ...(participantName && { participantName }),
        });

        const response = await fetch(`/api/livestream/token?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate token");
        }

        setToken(data.token);
      } catch (err) {
        console.error("Error fetching token:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [roomName, participantName]);

  return { token, isLoading, error };
}
