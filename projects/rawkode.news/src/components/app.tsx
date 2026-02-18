import * as React from "react";
import { RouterProvider } from "react-router-dom";
import {
  HydrationBoundary,
  type DehydratedState,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  type PersistedClient,
  type Persister,
  PersistQueryClientProvider,
} from "@tanstack/react-query-persist-client";
import { router } from "@/components/router";
import { persistMaxAge, queryClient } from "@/components/query-client";

type AppProps = {
  dehydratedState?: DehydratedState;
};

const PERSIST_KEY = "rkn-query-cache";

const createLocalStoragePersister = (): Persister | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    persistClient: async (persistedClient: PersistedClient) => {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(persistedClient));
    },
    restoreClient: async () => {
      const cached = window.localStorage.getItem(PERSIST_KEY);
      if (!cached) {
        return undefined;
      }

      try {
        return JSON.parse(cached) as PersistedClient;
      } catch {
        window.localStorage.removeItem(PERSIST_KEY);
        return undefined;
      }
    },
    removeClient: async () => {
      window.localStorage.removeItem(PERSIST_KEY);
    },
  };
};

export default function App({ dehydratedState }: AppProps) {
  const [persister] = React.useState(createLocalStoragePersister);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={dehydratedState}>
          <RouterProvider router={router} />
        </HydrationBoundary>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: persistMaxAge,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] !== "session",
        },
      }}
    >
      <HydrationBoundary state={dehydratedState}>
        <RouterProvider router={router} />
      </HydrationBoundary>
    </PersistQueryClientProvider>
  );
}
