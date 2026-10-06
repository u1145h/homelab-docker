export type ThemeMode = 'dark' | 'light' | 'system'

export type Density = 'compact' | 'comfortable' | 'spacious'

export type RadiusMode = 'default' | 'rounded' | 'square'

export type MotionMode = 'enabled' | 'reduced' | 'disabled'

export interface AppearanceState {
  theme: ThemeMode
  amoled: boolean
  density: Density
  radius: RadiusMode
  motion: MotionMode
}

export interface AppearanceContextValue extends AppearanceState {
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
  toggleAmoled: () => void
  setAmoled: (amoled: boolean) => void
  setDensity: (density: Density) => void
  setRadius: (radius: RadiusMode) => void
  setMotion: (motion: MotionMode) => void
}
