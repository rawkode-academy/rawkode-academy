import * as React from "react";
import { RouterProvider } from "react-router-dom";
import {
  HydrationBoundary,
  type DehydratedState,
  QueryClientProvider,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { router } from "@/components/router";
import { persistMaxAge, queryClient } from "@/components/query-client";

type AppProps = {
  dehydratedState?: DehydratedState;
};

export default function App({ dehydratedState }: AppProps) {
  const [persister] = React.useState(() =>
    typeof window !== "undefined"
      ? createSyncStoragePersister({ storage: window.localStorage })
      : null
  );

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
