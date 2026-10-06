export const breakpoints = {
  mobile: 640,
  tablet: 1024,
  laptop: 1280,
  desktop: 1536,
} as const

export type BreakpointKey = keyof typeof breakpoints

export function up(breakpoint: BreakpointKey): string {
  return `(min-width: ${breakpoints[breakpoint]}px)`
}

export function down(breakpoint: BreakpointKey): string {
  const max = breakpoints[breakpoint] - 1
  return `(max-width: ${max}px)`
}

export function between(lower: BreakpointKey, upper: BreakpointKey): string {
  return `(min-width: ${breakpoints[lower]}px) and (max-width: ${breakpoints[upper] - 1}px)`
}
