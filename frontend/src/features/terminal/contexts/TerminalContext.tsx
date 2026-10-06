import { createContext, useContext, createElement } from "react"
import type { ReactNode } from "react"
import { useTerminalTabs } from "../hooks/useTerminalTabs"

const TerminalContext = createContext<ReturnType<typeof useTerminalTabs> | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const value = useTerminalTabs()
  return createElement(TerminalContext.Provider, { value }, children)
}

export function useTerminalContext() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useTerminalContext must be used within TerminalProvider")
  return ctx
}
