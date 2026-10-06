import { navigation } from "./config"
import type { NavItem } from "./types"

export interface Breadcrumb {
  label: string
  path: string
}

export type CustomLabelResolver = (path: string, part: string) => string | null | undefined

export function getBreadcrumbs(
  pathname: string,
  customResolver?: CustomLabelResolver
): Breadcrumb[] {
  const parts = pathname.split("/").filter(Boolean)
  const crumbs: Breadcrumb[] = [{ label: "Home", path: "/" }]

  let current = ""
  for (const part of parts) {
    current += `/${part}`
    const item: NavItem | undefined = navigation.find((n) => n.path === current)
    const customLabel = customResolver ? customResolver(current, part) : null

    crumbs.push({
      label:
        customLabel ??
        item?.label ??
        (part.length > 12 && /^[a-f0-9]+$/i.test(part)
          ? part.substring(0, 12)
          : part.charAt(0).toUpperCase() + part.slice(1)),
      path: current,
    })
  }

  return crumbs
}
