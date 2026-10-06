import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import MemoryPageFeature from "@/features/memory/pages/MemoryPage"

export default function MemoryPage() {
  useDocumentTitle('Memory - HomeLab')
  return <MemoryPageFeature />
}
