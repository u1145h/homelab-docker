import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'
import { TextInput } from '@/components/ui/forms'
import { Button } from '@/components/ui/actions'
import { LoadingState } from '@/components/ui/feedback'
import { radius } from '@/design/radius'
import { setupUser2FA, verifyUser2FA } from '../api/users'
import type { Setup2FAResponse } from '../types'

interface TwoFactorSetupDialogProps {
  open: boolean
  userId: string
  username: string
  onClose: () => void
  onSuccess: () => void
}

export default function TwoFactorSetupDialog({ open, userId, username, onClose, onSuccess }: TwoFactorSetupDialogProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Setup2FAResponse | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedUri, setCopiedUri] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  useEffect(() => {
    if (!open || !userId) {
      setData(null)
      setCode('')
      setError(null)
      setCopiedSecret(false)
      setCopiedUri(false)
      setCopiedCodes(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    setupUser2FA(userId)
      .then((res) => {
        if (isMounted) {
          setData(res)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize 2FA setup.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open, userId])

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length < 6) {
      setError('Please enter a valid 6-digit verification code.')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      await verifyUser2FA(userId, code.trim())
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please check the code.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCopySecret = () => {
    if (!data?.secret) return
    navigator.clipboard.writeText(data.secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const handleCopyUri = () => {
    if (!data?.uri) return
    navigator.clipboard.writeText(data.uri)
    setCopiedUri(true)
    setTimeout(() => setCopiedUri(false), 2000)
  }

  const handleCopyRecoveryCodes = () => {
    if (!data?.recovery_codes) return
    navigator.clipboard.writeText(data.recovery_codes.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: radius.modal,
            bgcolor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
        Setup Two-Factor Authentication (2FA)
      </DialogTitle>

      <DialogContent sx={{ fontSize: 12 }}>
        {loading ? (
          <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
            <LoadingState message="Generating 2FA keys..." />
          </div>
        ) : error && !data ? (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: radius.card,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--kuro-color-danger, #ef4444)',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: 'var(--kuro-color-text-secondary)', lineHeight: 1.5 }}>
              Setting up 2FA for <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', fontFamily: 'monospace' }}>@{username}</span>. Scan the offline QR code using your <strong>Bitwarden / Vaultwarden</strong> authenticator (or any RFC 6238 TOTP app), or copy the secret key into your vault.
            </div>

            {/* QR Code & Secret */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 20,
                alignItems: 'center',
                padding: 16,
                borderRadius: radius.card,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--kuro-color-border)',
                flexWrap: 'wrap',
              }}
            >
              {data.uri && (
                <div
                  style={{
                    width: 130,
                    height: 130,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <QRCodeSVG
                    value={data.uri}
                    size={114}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Manual Secret Key
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    padding: '8px 12px',
                    borderRadius: radius.button,
                    backgroundColor: 'var(--kuro-color-surface-container, rgba(0,0,0,0.3))',
                    border: '1px solid var(--kuro-color-border)',
                    color: 'var(--kuro-color-accent)',
                    wordBreak: 'break-all',
                    userSelect: 'all',
                  }}
                >
                  {data.secret}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: radius.badge,
                      border: '1px solid var(--kuro-color-border)',
                      backgroundColor: 'transparent',
                      color: copiedSecret ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedSecret ? '✓ Key Copied' : 'Copy Secret Key'}
                  </button>
                  {data.uri && (
                    <button
                      type="button"
                      onClick={handleCopyUri}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 500,
                        borderRadius: radius.badge,
                        border: '1px solid var(--kuro-color-border)',
                        backgroundColor: 'transparent',
                        color: copiedUri ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedUri ? '✓ Bitwarden URI Copied' : 'Copy Bitwarden URI'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recovery Codes */}
            {data.recovery_codes && data.recovery_codes.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: radius.card,
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--kuro-color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Emergency Recovery Codes
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRecoveryCodes}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedCodes ? 'var(--kuro-color-accent)' : 'var(--kuro-color-accent)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {copiedCodes ? '✓ Copied' : 'Copy All Codes'}
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: 'var(--kuro-color-text-secondary)',
                  }}
                >
                  {data.recovery_codes.map((rc, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '4px 6px',
                        backgroundColor: 'var(--kuro-color-surface-container, rgba(0,0,0,0.2))',
                        borderRadius: 4,
                        textAlign: 'center',
                      }}
                    >
                      {rc}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation Code Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                Verify & Activate
              </div>
              <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                Enter the 6-digit code currently shown in your authenticator app to confirm setup.
              </div>

              {error && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: 'var(--kuro-color-danger, #ef4444)',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {error}
                </div>
              )}

              <TextInput
                autoFocus
                fullWidth
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setError(null)
                }}
                disabled={verifying}
                slotProps={{
                  htmlInput: {
                    maxLength: 8,
                    style: { textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 700 },
                  },
                }}
                sx={{ mt: 1 }}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="ghost" onClick={onClose} disabled={verifying}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleVerify}
          disabled={!data || code.trim().length < 6 || verifying}
        >
          {verifying ? 'Verifying...' : 'Verify & Enable 2FA'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
