import type { Theme } from '@mui/material'

export function injectCSSVariables(theme: Theme, isAmoled = false): void {
  const root = document.documentElement
  const p = theme.palette
  const vars: Record<string, string> = {}

  vars['--kuro-color-background'] = p.background.default
  vars['--kuro-color-surface'] = p.background.paper
  vars['--kuro-color-surface-elevated'] = isAmoled ? '#0c0c0c' : (p.mode === 'dark' ? '#161819' : '#FAFAF8')
  vars['--kuro-color-hover'] = isAmoled ? '#141414' : (p.mode === 'dark' ? '#1F2121' : '#F0EDE6')
  vars['--kuro-color-surface-hover'] = vars['--kuro-color-hover']
  vars['--kuro-color-surface-input'] = vars['--kuro-color-surface-elevated']
  vars['--kuro-color-border'] = p.divider
  vars['--kuro-color-border-subtle'] = p.divider
  vars['--kuro-color-accent'] = p.primary.main
  vars['--kuro-color-primary'] = p.primary.main
  vars['--kuro-color-success'] = p.success.main
  vars['--kuro-color-info'] = p.info.main
  vars['--kuro-color-warning'] = p.warning.main
  vars['--kuro-color-danger'] = p.error.main
  vars['--kuro-color-purple'] = p.secondary.main
  vars['--kuro-color-text-primary'] = p.text.primary
  vars['--kuro-color-text-secondary'] = p.text.secondary
  vars['--kuro-color-text-muted'] = p.text.disabled
  vars['--kuro-color-sidebar-text'] = p.mode === 'dark' ? '#7a7872' : '#555555'
  vars['--kuro-color-sidebar-category'] = p.mode === 'dark' ? (isAmoled ? '#2b2c24' : '#3e3f35') : '#888888'

  root.setAttribute('data-theme', p.mode)
  root.setAttribute('data-amoled', isAmoled ? 'true' : 'false')

  const spacing = theme.spacing
  const spaceSteps = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]
  const spaceNames = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
  spaceSteps.forEach((step, i) => {
    vars[`--kuro-spacing-${spaceNames[i]}`] = spacing(step)
  })

  const shape = theme.shape
  if (shape.borderRadius !== undefined) {
    vars['--kuro-radius-card'] = `${shape.borderRadius}px`
    vars['--kuro-radius-button'] = '12px'
    vars['--kuro-radius-input'] = `${shape.borderRadius}px`
    vars['--kuro-radius-badge'] = '9999px'
    vars['--kuro-radius-modal'] = `${shape.borderRadius}px`
  }

  vars['--kuro-font-family-sans'] = theme.typography.fontFamily || "'Plus Jakarta Sans', system-ui, sans-serif"
  vars['--kuro-font-family-heading'] = "'Space Grotesk', system-ui, sans-serif"
  vars['--kuro-font-family-mono'] = "'JetBrains Mono', 'Space Mono', monospace"
  vars['--kuro-font-size-heading'] = '18px'
  vars['--kuro-font-size-title'] = '18px'
  vars['--kuro-font-size-body'] = '11px'
  vars['--kuro-font-size-caption'] = '11px'
  vars['--kuro-font-size-tiny'] = '10px'

  vars['--kuro-transition-fast'] = '100ms ease-in-out'
  vars['--kuro-transition-normal'] = '150ms ease-in-out'
  vars['--kuro-transition-slow'] = '300ms ease-in-out'

  vars['--kuro-layout-sidebar-width'] = '240px'
  vars['--kuro-layout-topbar-height'] = '64px'
  vars['--kuro-layout-page-padding'] = '32px'

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

export function clearCSSVariables(): void {
  const root = document.documentElement
  const prefixes = [
    '--kuro-color-', '--kuro-spacing-', '--kuro-radius-',
    '--kuro-font-', '--kuro-transition-', '--kuro-layout-',
  ]
  for (let i = root.style.length - 1; i >= 0; i--) {
    const name = root.style.item(i)
    if (prefixes.some((p) => name.startsWith(p))) {
      root.style.removeProperty(name)
    }
  }
}
