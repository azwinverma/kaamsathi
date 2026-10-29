"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageViewTracker } from "./page-view-tracker";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        <PageViewTracker />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: "font-sans" } }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
