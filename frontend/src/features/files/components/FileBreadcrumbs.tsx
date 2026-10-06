import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { AppIcon } from "@/components/ui/icons"
import { pathParts } from "../utils/files"

interface FileBreadcrumbsProps {
  path: string
  onNavigate: (path: string) => void
}

export default function FileBreadcrumbs({ path, onNavigate }: FileBreadcrumbsProps) {
  const parts = pathParts(path)

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, userSelect: "none" }}>
      {parts.map((part, index, arr) => {
        const isRoot = index === 0 && part === "/"
        const target = isRoot ? "/" : "/" + arr.slice(1, index + 1).join("/")
        const isLast = index === arr.length - 1

        return (
          <Box key={target + index} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {index > 0 && (
              <AppIcon name="chevron-right" size={12} style={{ color: "var(--kuro-color-text-muted)" }} />
            )}

            <Typography
              variant="body2"
              onClick={() => onNavigate(target)}
              sx={{
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                fontSize: 11,
                fontWeight: isLast ? 600 : 400,
                color: isLast
                  ? "var(--kuro-color-text-primary)"
                  : "var(--kuro-color-text-secondary)",
                cursor: "pointer",
                transition: "var(--kuro-transition-fast)",
                "&:hover": {
                  color: "var(--kuro-color-text-primary)",
                  textDecoration: "underline",
                },
              }}
            >
              {isRoot ? "/" : part}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
