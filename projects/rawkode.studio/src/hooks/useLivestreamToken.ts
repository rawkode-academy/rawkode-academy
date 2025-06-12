import { useCallback, useEffect, useState } from "react";

interface UseTokenOptions {
  roomName?: string;
  displayName?: string;
}

interface TokenResult {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useLivestreamToken({
  roomName,
  displayName,
}: UseTokenOptions): TokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to refresh the token
  const refreshToken = useCallback(async (currentToken: string) => {
    try {
      const response = await fetch("/api/livestream/refresh-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: currentToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh token");
      }

      setToken(data.token);
      setError(null);
    } catch (err) {
      console.error("Error refreshing token:", err);
      setError(err instanceof Error ? err : new Error("Token refresh failed"));
    }
  }, []);

  useEffect(() => {
    if (!roomName) {
      setIsLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/livestream/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomName,
            ...(displayName && { displayName }),
          }),
        });
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
  }, [roomName, displayName]);

  // Set up polling for token refresh
  useEffect(() => {
    if (!token) {
      return;
    }

    // Refresh token every minute
    const interval = setInterval(() => {
      refreshToken(token);
    }, 60 * 1000); // 1 minute

    // Cleanup interval on unmount or when token changes
    return () => {
      clearInterval(interval);
    };
  }, [token, refreshToken]);

  return { token, isLoading, error };
}
