import { useState, useEffect } from 'react'

export function useMetricHistory(value: number, maxLength: number = 8): number[] {
  const [history, setHistory] = useState<number[]>([0])

  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === value) {
        return prev
      }
      const next = [...prev, value]
      return next.length > maxLength ? next.slice(-maxLength) : next
    })
  }, [value, maxLength])

  return history
}
