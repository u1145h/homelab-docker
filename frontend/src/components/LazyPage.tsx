import { Suspense } from "react"
import type { ReactNode } from "react"
import PageLoader from "./PageLoader"

interface LazyPageProps {
  children: ReactNode
}

export default function LazyPage({ children }: LazyPageProps) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}
