import { useState, useRef, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from '@/components/ui/surface'
import { Stack } from '@/components/ui/layout'
import { TextInput, PasswordInput, Checkbox } from '@/components/ui/forms'
import { Button } from '@/components/ui/actions'
import { LoadingState } from '@/components/ui/feedback'
import { useAuth } from "@/contexts/AuthContext"
import { useServer } from "@/contexts/ServerContext"
import { isNativeMobileApp } from "@/utils/serverStorage"
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function LoginPage() {
  useDocumentTitle('Sign In - HomeLab')
  const { login } = useAuth()
  const { activeProfile, resetServerConfig } = useServer()
  const navigate = useNavigate()
  const passwordRef = useRef<HTMLInputElement>(null)
  const totpRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [require2FA, setRequire2FA] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cooldown, setCooldown] = useState<number | null>(null)

  useEffect(() => {
    if (cooldown === null || cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev === null || prev <= 1) return null
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const canSubmit = !loading && (
    require2FA
      ? totpCode.trim().length >= 6
      : (username.trim() !== "" && password !== "" && (cooldown === null || cooldown <= 0))
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      if (!username.trim() || !password) return
      if (require2FA && !totpCode.trim()) return

      setLoading(true)
      setError("")

      try {
        const res = await login({
          username: username.trim(),
          password,
          rememberMe,
          totp_code: require2FA ? totpCode.trim() : undefined,
        })

        if (res.require_2fa) {
          setRequire2FA(true)
          setTotpCode("")
          setTimeout(() => totpRef.current?.focus(), 100)
          return
        }

        navigate("/", { replace: true })
      } catch (err: unknown) {
        if (require2FA) {
          setTotpCode("")
          totpRef.current?.focus()
        } else {
          setPassword("")
          passwordRef.current?.focus()
        }

        if (err && typeof err === "object" && "response" in err) {
          const axiosErr = err as { response?: { status?: number; data?: { error?: string; retry_after?: number } } }
          if (axiosErr.response?.status === 429) {
            const retryAfter = axiosErr.response.data?.retry_after ?? 60
            setCooldown(retryAfter)
            setError(axiosErr.response.data?.error || `Too many failed attempts. Locked for ${retryAfter}s.`)
          } else if (axiosErr.response?.status === 403) {
            setError(axiosErr.response.data?.error || "Access forbidden for this account role.")
          } else if (axiosErr.response?.status === 401) {
            setError(axiosErr.response.data?.error || (require2FA ? "Invalid 2FA code." : "Invalid username or password."))
          } else {
            setError(axiosErr.response?.data?.error || "Server error. Please try again.")
          }
        } else if (err instanceof Error) {
          setError(err.message || "Unable to connect to server. Check your connection.")
        } else {
          setError("Login failed. Please try again.")
        }
      } finally {
        setLoading(false)
      }
    },
    [username, password, rememberMe, require2FA, totpCode, login, navigate],
  )

  const handleBackToPassword = () => {
    setRequire2FA(false)
    setTotpCode("")
    setError("")
    setTimeout(() => passwordRef.current?.focus(), 100)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--kuro-color-background)',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }} role="region" aria-label="login form">
        <Card variant="default">
          <CardContent>
            <Stack gap={24} align="center">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', alignItems: 'start', justifyContent: 'start' }}>
                <img src="/favicon.svg" alt="HomeLab" style={{ width: 'auto', height: 70 }} />
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--kuro-color-text-primary)', textTransform: 'uppercase' }}>
                  HomeLab
                </div>
                <div
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: 1.5,
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    fontWeight: 400,
                    color: 'var(--kuro-color-text-muted)',
                  }}
                >
                  {require2FA ? "Two-factor authentication challenge" : "Sign in to access your server"}
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
                <Stack gap={16}>
                  {error && (
                    <div
                      role="alert"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: 'color-mix(in srgb, var(--kuro-color-danger) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--kuro-color-danger) 30%, transparent)',
                        color: 'var(--kuro-color-danger)',
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  {!require2FA ? (
                    <>
                      <TextInput
                        placeholder="Username"
                        name="username"
                        fullWidth
                        autoFocus
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading || (cooldown !== null && cooldown > 0)}
                        slotProps={{ htmlInput: { 'aria-label': 'Username' } }}
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '5px' },
                          '& .MuiInputBase-input': {
                            fontSize: '14px',
                            padding: '12px 14px',
                          },
                        }}
                      />

                      <PasswordInput
                        placeholder="Password"
                        name="password"
                        fullWidth
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || (cooldown !== null && cooldown > 0)}
                        inputRef={passwordRef}
                        slotProps={{ htmlInput: { 'aria-label': 'Password' } }}
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '5px' },
                          '& .MuiInputBase-input': {
                            fontSize: '14px',
                            padding: '12px 14px',
                          },
                        }}
                      />

                      <Checkbox
                        label="Remember Me"
                        checked={rememberMe}
                        onChange={(ch) => setRememberMe(ch)}
                        disabled={loading || (cooldown !== null && cooldown > 0)}
                        sx={{
                          margin: 0,
                          alignSelf: 'flex-start',
                          '& .MuiSvgIcon-root': { fontSize: 22 },
                          '& .MuiFormControlLabel-label': {
                            margin: 0,
                            fontSize: '14px',
                            lineHeight: 1.5,
                            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                            fontWeight: 400,
                            color: 'var(--kuro-color-text-secondary)',
                          },
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--kuro-color-text-secondary)',
                          lineHeight: 1.5,
                          backgroundColor: 'var(--kuro-color-surface-container-high, rgba(255,255,255,0.04))',
                          padding: '10px 14px',
                          borderRadius: 8,
                        }}
                      >
                        Enter the 6-digit verification code from your authenticator app (or a recovery code).
                      </div>

                      <TextInput
                        placeholder="000 000"
                        name="totp_code"
                        fullWidth
                        autoFocus
                        autoComplete="one-time-code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        disabled={loading}
                        inputRef={totpRef}
                        slotProps={{ htmlInput: { 'aria-label': '2FA Verification Code', maxLength: 12, style: { textAlign: 'center', letterSpacing: '3px', fontSize: '18px', fontWeight: 600 } } }}
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '5px' },
                          '& .MuiInputBase-input': {
                            padding: '12px 14px',
                          },
                        }}
                      />
                    </>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    size="large"
                    disabled={!canSubmit}
                    aria-busy={loading}
                    sx={{
                      backgroundColor: '#a9b665',
                      borderRadius: '5px',
                      border: '1px solid #a2ae60',
                      color: '#111314',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      '&:hover': {
                        backgroundColor: '#7daea3',
                        border: '1px solid #3f514d',
                        color: '#111314',
                      },
                    }}
                  >
                    {loading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '14px', textTransform: 'uppercase' }}>
                        <LoadingState size="sm" inline />
                        {require2FA ? "Verifying..." : "Signing in..."}
                      </span>
                    ) : cooldown !== null && cooldown > 0 ? (
                      `Retry in ${cooldown}s`
                    ) : require2FA ? (
                      "VERIFY & SIGN IN"
                    ) : (
                      "LOGIN"
                    )}
                  </Button>

                  {require2FA && (
                    <Button
                      type="button"
                      variant="ghost"
                      fullWidth
                      size="medium"
                      onClick={handleBackToPassword}
                      disabled={loading}
                    >
                      Back to password
                    </Button>
                  )}
                </Stack>
              </form>

              {isNativeMobileApp() && activeProfile && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    paddingTop: 12,
                    borderTop: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                    fontSize: 12,
                    color: 'var(--kuro-color-text-muted)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', fontFamily: 'monospace' }}>
                    Server: {activeProfile.url}
                  </span>
                  <button
                    type="button"
                    onClick={resetServerConfig}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--kuro-color-accent, #a9b665)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 6px',
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </Stack>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
