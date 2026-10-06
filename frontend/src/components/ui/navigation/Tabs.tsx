import { forwardRef } from 'react'
import MuiTabs, { type TabsProps } from '@mui/material/Tabs'
import MuiTab, { type TabProps } from '@mui/material/Tab'

export interface KuroTabsProps extends TabsProps {}

export const Tabs = forwardRef<HTMLDivElement, KuroTabsProps>((props, ref) => (
  <MuiTabs
    ref={ref}
    textColor="inherit"
    {...props}
  />
))

Tabs.displayName = 'Tabs'

export interface KuroTabProps extends TabProps {}

export const Tab = forwardRef<HTMLDivElement, KuroTabProps>((props, ref) => (
  <MuiTab ref={ref} {...props} />
))

Tab.displayName = 'Tab'
