import { useQuery } from "@tanstack/react-query";
import type { ApiSession } from "@/components/app-data";

export const sessionQueryOptions = () => ({
  queryKey: ["session"],
  queryFn: async () => {
    const response = await fetch("/api/auth/session");
    if (response.status === 204) {
      return null;
    }
    if (!response.ok) {
      throw new Error("Failed to load session");
    }
    return (await response.json()) as ApiSession;
  },
  staleTime: 60_000,
  refetchOnWindowFocus: false,
});

export const useSession = () => useQuery(sessionQueryOptions());
