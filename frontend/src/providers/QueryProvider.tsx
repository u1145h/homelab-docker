import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 s — no background refetch on remount within this window
      staleTime: 30_000,
      // Keep unused cache entries for 5 minutes before garbage-collecting them
      gcTime: 5 * 60_000,
      // Don't hammer the server on every window focus (still refetches when stale)
      refetchOnWindowFocus: false,
      // Retry failed requests once before showing an error
      retry: 1,
    },
  },
})

interface QueryProviderProps {
  children: ReactNode
}

export default function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
