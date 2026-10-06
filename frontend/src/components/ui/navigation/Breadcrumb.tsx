import { forwardRef, Fragment } from 'react'
import MuiBreadcrumbs from '@mui/material/Breadcrumbs'
import { AppIcon, type IconName } from '@/components/ui/icons'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: IconName
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export const Breadcrumb = forwardRef<HTMLDivElement, BreadcrumbProps>(
  ({ items, className }, ref) => (
    <MuiBreadcrumbs
      ref={ref}
      className={className}
      separator={<AppIcon name="chevron-right" size={14} />}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        const content = (
          <Fragment>
            {item.icon && (
              <AppIcon
                name={item.icon}
                size={14}
                style={{ marginRight: 4, verticalAlign: 'middle' }}
              />
            )}
            {item.label}
          </Fragment>
        )
        if (isLast) {
          return (
            <span
              key={i}
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}
            >
              {content}
            </span>
          )
        }
        return (
          <a
            key={i}
            href={item.href ?? '#'}
            style={{
              fontSize: 14,
              color: 'var(--kuro-color-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={(e) => { if (!item.href) e.preventDefault() }}
          >
            {content}
          </a>
        )
      })}
    </MuiBreadcrumbs>
  ),
)

Breadcrumb.displayName = 'Breadcrumb'
