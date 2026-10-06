import { useState, useCallback, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import type { AlertColor } from "@mui/material"
import { AppIcon } from "@/components/ui/icons"
import { SnackbarContext, type SnackbarOptions, type SnackbarMessage } from "./snackbarContext"
import { radius } from "@/design/radius"
import { navigateTo } from "@/utils/navigation"

const DEFAULT_DURATION = 4000
const MAX_VISIBLE_TOASTS = 3

interface ToastItemProps {
  toast: SnackbarMessage
  onClose: (id: string) => void
}

function getToastTheme(severity: AlertColor): {
  color: string
  bgGlow: string
  border: string
  iconName: any
  label: string
} {
  switch (severity) {
    case "success":
      return {
        color: "#89B482",
        bgGlow: "rgba(137, 180, 130, 0.12)",
        border: "rgba(137, 180, 130, 0.35)",
        iconName: "check-circle",
        label: "SUCCESS",
      }
    case "error":
      return {
        color: "#EA6962",
        bgGlow: "rgba(234, 105, 98, 0.12)",
        border: "rgba(234, 105, 98, 0.35)",
        iconName: "alert-triangle",
        label: "ERROR",
      }
    case "warning":
      return {
        color: "#E78A4E",
        bgGlow: "rgba(231, 138, 78, 0.12)",
        border: "rgba(231, 138, 78, 0.35)",
        iconName: "alert-triangle",
        label: "WARNING",
      }
    case "info":
    default:
      return {
        color: "#7DAEA3",
        bgGlow: "rgba(125, 174, 163, 0.12)",
        border: "rgba(125, 174, 163, 0.35)",
        iconName: "info",
        label: "INFO",
      }
  }
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const duration = toast.duration ?? DEFAULT_DURATION
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(100)
  const [isClosing, setIsClosing] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const remainingTimeRef = useRef<number>(duration)

  const theme = getToastTheme(toast.severity)

  const handleDismiss = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose(toast.id)
    }, 180)
  }, [onClose, toast.id])

  useEffect(() => {
    if (isHovered) return

    startTimeRef.current = Date.now()
    const totalRemaining = remainingTimeRef.current

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const currentRemaining = Math.max(0, totalRemaining - elapsed)
      const currentProgress = (currentRemaining / duration) * 100
      setProgress(currentProgress)

      if (currentRemaining <= 0) {
        clearInterval(interval)
        handleDismiss()
      }
    }, 30)

    return () => {
      clearInterval(interval)
      const elapsed = Date.now() - startTimeRef.current
      remainingTimeRef.current = Math.max(0, totalRemaining - elapsed)
    }
  }, [isHovered, duration, handleDismiss])

  const handleAction = () => {
    handleDismiss()
    if (toast.actionUrl) {
      navigateTo(toast.actionUrl)
    } else {
      navigateTo("/recent-activity")
    }
  }

  return (
    <div
      className={`kuro-toast-item ${isClosing ? "closing" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 380,
        backgroundColor: "rgba(18, 20, 22, 0.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderRadius: radius.card,
        border: `1px solid ${theme.border}`,
        boxShadow: `0 12px 32px rgba(0, 0, 0, 0.55), 0 0 16px ${theme.bgGlow}`,
        overflow: "hidden",
        transition: "transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      {/* Accent Left Stripe Indicator */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3.5,
          backgroundColor: theme.color,
          boxShadow: `0 0 8px ${theme.color}`,
        }}
      />

      {/* Main Toast Content Body */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "11px 14px 11px 16px",
        }}
      >
        {/* Severity Icon Badge */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            backgroundColor: theme.bgGlow,
            border: `1px solid ${theme.border}`,
            color: theme.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <AppIcon name={theme.iconName} size={15} />
        </div>

        {/* Text Content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Header Row: Severity Pill / Title + Timestamp */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: theme.color,
                textTransform: "uppercase",
                fontFamily: "var(--kuro-font-family-mono, monospace)",
              }}
            >
              {toast.title || theme.label}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--kuro-color-text-muted, rgba(255,255,255,0.4))",
                fontFamily: "var(--kuro-font-family-mono, monospace)",
              }}
            >
              {toast.timestamp || "Just now"}
            </span>
          </div>

          {/* Toast Message Body */}
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "var(--kuro-color-text-primary, #CECBC4)",
              wordBreak: "break-word",
            }}
          >
            {toast.message}
          </div>

          {/* Action Link (e.g. View in Notifications / Action Url) */}
          {(toast.actionUrl || toast.actionLabel) && (
            <button
              type="button"
              onClick={handleAction}
              style={{
                alignSelf: "flex-start",
                marginTop: 4,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: theme.color,
                backgroundColor: theme.bgGlow,
                border: `1px solid ${theme.border}`,
                borderRadius: 4,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.border
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.bgGlow
              }}
            >
              <span>{toast.actionLabel || "View Details"}</span>
              <span style={{ fontSize: 10 }}>▸</span>
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            padding: 0,
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: "var(--kuro-color-text-secondary, #928f87)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--kuro-color-text-primary, #fff)"
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--kuro-color-text-secondary, #928f87)"
            e.currentTarget.style.backgroundColor = "transparent"
          }}
        >
          <AppIcon name="x" size={13} />
        </button>
      </div>

      {/* Auto-Dismiss Timer Progress Line */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: theme.color,
            transition: isHovered ? "none" : "width 30ms linear",
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  )
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<SnackbarMessage[]>([])

  const closeSnackbar = useCallback((id?: string) => {
    if (!id) {
      setToasts([])
      return
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showSnackbar = useCallback(
    (message: string, severity: AlertColor = "info", options?: SnackbarOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const newToast: SnackbarMessage = {
        id,
        message,
        severity,
        title: options?.title,
        actionUrl: options?.actionUrl,
        actionLabel: options?.actionLabel,
        duration: options?.duration,
        timestamp: "Just now",
      }

      setToasts((prev) => {
        const next = [newToast, ...prev]
        return next.slice(0, MAX_VISIBLE_TOASTS)
      })
    },
    []
  )

  return (
    <SnackbarContext.Provider value={{ showSnackbar, closeSnackbar }}>
      {children}

      {/* Top-Right Floating Notification Container (Aligned directly beneath Header Bar) */}
      <div
        style={{
          position: "fixed",
          top: 68,
          right: 20,
          zIndex: 1400,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          width: "calc(100vw - 40px)",
          maxWidth: 380,
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={closeSnackbar} />
        ))}
      </div>
    </SnackbarContext.Provider>
  )
}
