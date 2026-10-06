import React, { useState } from 'react'
import { Camera, Clipboard, Send, RefreshCw } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import {
  getWindowsScreenshot,
  getWindowsClipboard,
  setWindowsClipboard,
  sendWindowsToast,
} from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsQuickActionsProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsQuickActions: React.FC<WindowsQuickActionsProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [screenshotB64, setScreenshotB64] = useState<string | null>(null)
  const [capturing, setCapturing] = useState<boolean>(false)
  const [clipboardText, setClipboardText] = useState<string>('')
  const [readingClip, setReadingClip] = useState<boolean>(false)
  const [writingClip, setWritingClip] = useState<boolean>(false)
  const [toastTitle, setToastTitle] = useState<string>('HomeLab Alert')
  const [toastMsg, setToastMsg] = useState<string>('')
  const [sendingToast, setSendingToast] = useState<boolean>(false)

  const handleCaptureScreenshot = async () => {
    setCapturing(true)
    try {
      const res = await getWindowsScreenshot(nodeId)
      if (res?.image_b64) {
        setScreenshotB64(res.image_b64)
        showSnackbar('Captured remote desktop screenshot', 'success')
      }
    } catch (err: any) {
      showSnackbar(`Screenshot capture failed: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setCapturing(false)
    }
  }

  const handleReadClipboard = async () => {
    setReadingClip(true)
    try {
      const res = await getWindowsClipboard(nodeId)
      setClipboardText(res?.text || '')
      showSnackbar('Fetched remote clipboard text', 'success')
    } catch (err: any) {
      showSnackbar(`Failed to read clipboard: ${err?.message}`, 'error')
    } finally {
      setReadingClip(false)
    }
  }

  const handleSetClipboard = async () => {
    if (!clipboardText) return
    setWritingClip(true)
    try {
      await setWindowsClipboard(nodeId, clipboardText)
      showSnackbar('Pushed text to Windows clipboard', 'success')
    } catch (err: any) {
      showSnackbar(`Failed to set clipboard: ${err?.message}`, 'error')
    } finally {
      setWritingClip(false)
    }
  }

  const handleSendToast = async () => {
    if (!toastMsg) return
    setSendingToast(true)
    try {
      await sendWindowsToast(nodeId, toastTitle, toastMsg)
      showSnackbar('Toast notification displayed on Windows desktop', 'success')
      setToastMsg('')
    } catch (err: any) {
      showSnackbar(`Failed to send toast: ${err?.message}`, 'error')
    } finally {
      setSendingToast(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Grid of Control Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          gap: 14,
        }}
      >
        {/* Remote Screenshot Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={18} color="var(--kuro-color-accent, #a9b665)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
                Remote Desktop Screenshot
              </span>
            </div>
            <button
              onClick={handleCaptureScreenshot}
              disabled={capturing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                backgroundColor: 'rgba(169, 182, 101, 0.15)',
                border: '1px solid rgba(169, 182, 101, 0.3)',
                borderRadius: radius.button,
                color: 'var(--kuro-color-accent, #a9b665)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={capturing ? 'spin' : ''} />
              {capturing ? 'Capturing...' : 'Capture Now'}
            </button>
          </div>

          <div
            style={{
              height: 200,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: radius.card,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            {screenshotB64 ? (
              <img
                src={screenshotB64}
                alt="Remote Desktop"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted, #777)' }}>
                Click "Capture Now" to grab remote desktop frame
              </span>
            )}
          </div>
        </div>

        {/* Remote Clipboard Sync */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clipboard size={18} color="#60a5fa" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
              Remote Clipboard Sync
            </span>
          </div>

          <textarea
            placeholder="Type or paste text to sync with Windows clipboard..."
            value={clipboardText}
            onChange={(e) => setClipboardText(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
              borderRadius: radius.input,
              padding: '8px 12px',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'var(--kuro-font-mono, monospace)',
              outline: 'none',
              resize: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleReadClipboard}
              disabled={readingClip}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: radius.button,
                color: '#fff',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {readingClip ? 'Reading...' : 'Pull From PC'}
            </button>
            <button
              onClick={handleSetClipboard}
              disabled={writingClip || !clipboardText}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: radius.button,
                color: '#60a5fa',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {writingClip ? 'Pushing...' : 'Push To PC Clipboard'}
            </button>
          </div>
        </div>

        {/* Windows Toast Notification Sender */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={18} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
              Windows Desktop Toast Dispatcher
            </span>
          </div>

          <input
            type="text"
            placeholder="Notification Title"
            value={toastTitle}
            onChange={(e) => setToastTitle(e.target.value)}
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
              borderRadius: radius.input,
              padding: '6px 10px',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />

          <input
            type="text"
            placeholder="Message body (e.g. Build completed on server!)"
            value={toastMsg}
            onChange={(e) => setToastMsg(e.target.value)}
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
              borderRadius: radius.input,
              padding: '6px 10px',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSendToast}
              disabled={sendingToast || !toastMsg}
              style={{
                padding: '6px 14px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: radius.button,
                color: '#f59e0b',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {sendingToast ? 'Displaying...' : 'Send Toast Notification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
