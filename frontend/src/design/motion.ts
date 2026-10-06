export const motion = {
  duration: {
    fast: 100,
    normal: 150,
    slow: 300,
  },
  easing: {
    default: 'ease-in-out',
    enter: 'ease-out',
    exit: 'ease-in',
  },
} as const

export type MotionDuration = keyof typeof motion.duration
export type MotionEasing = keyof typeof motion.easing

export function getTransition(properties: string[], duration: MotionDuration = 'normal'): string {
  const dur = motion.duration[duration]
  return properties.map((p) => `${p} ${dur}ms ${motion.easing.default}`).join(', ')
}
