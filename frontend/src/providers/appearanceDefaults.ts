import type { AppearanceState, Density, MotionMode, RadiusMode, ThemeMode } from './appearanceTypes'

export const CURRENT_STORAGE_VERSION = 1

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: 'dark',
  amoled: false,
  density: 'comfortable',
  radius: 'default',
  motion: 'enabled',
}

export const THEME_OPTIONS: ThemeMode[] = ['dark', 'light', 'system']
export const DENSITY_OPTIONS: Density[] = ['compact', 'comfortable', 'spacious']
export const RADIUS_OPTIONS: RadiusMode[] = ['default', 'rounded', 'square']
export const MOTION_OPTIONS: MotionMode[] = ['enabled', 'reduced', 'disabled']
