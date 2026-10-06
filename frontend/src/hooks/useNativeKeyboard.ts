import { useState, useEffect } from 'react'
import { isNativeMobileApp } from '@/utils/serverStorage'
import { Keyboard } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'

// Cache baseline height of the visible area when keyboard is closed
let maxSeenHeight = typeof window !== 'undefined' ? window.innerHeight : 0

export function useNativeKeyboard(isTerminalPage = false) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const isAndroidApp = isNativeMobileApp()

  useEffect(() => {
    // Only active on Android Native App
    if (!isAndroidApp) {
      setIsKeyboardOpen(false)
      document.body.removeAttribute('data-terminal-keyboard-open')
      document.body.removeAttribute('data-native-keyboard-open')
      return
    }

    if (typeof window === 'undefined') return

    const updateBaseline = () => {
      const h = window.innerHeight
      if (h > maxSeenHeight) {
        maxSeenHeight = h
      }
    }
    updateBaseline()

    const setKeyboardState = (open: boolean) => {
      setIsKeyboardOpen(open)
      if (open) {
        document.body.setAttribute('data-terminal-keyboard-open', 'true')
        document.body.setAttribute('data-native-keyboard-open', 'true')
      } else {
        document.body.removeAttribute('data-terminal-keyboard-open')
        document.body.removeAttribute('data-native-keyboard-open')
      }
    }

    const evaluateFromHeight = () => {
      const currentH = window.innerHeight
      if (currentH > maxSeenHeight) {
        maxSeenHeight = currentH
      }

      const drop = maxSeenHeight - currentH
      // On Android soft keyboards are >= 180px tall.
      // If height drop is > 140px, keyboard is open.
      // If height drop is <= 100px, keyboard is closed.
      if (drop > 140) {
        setKeyboardState(true)
      } else if (drop <= 100) {
        setKeyboardState(false)
      }
    }

    // 1. Listen to Capacitor native Keyboard plugin events
    let hasCapacitorKeyboard = false
    let showSub: any = null
    let hideSub: any = null

    if (Capacitor.isPluginAvailable('Keyboard') || Capacitor.isNativePlatform()) {
      hasCapacitorKeyboard = true
      Keyboard.addListener('keyboardWillShow', () => {
        setKeyboardState(true)
      }).then((sub) => { showSub = sub }).catch(() => {})

      Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardState(true)
      }).catch(() => {})

      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardState(false)
      }).then((sub) => { hideSub = sub }).catch(() => {})

      Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardState(false)
      }).catch(() => {})
    }

    // 2. Viewport & Window Resize listeners (reliable fallback & sync)
    const onResize = () => {
      evaluateFromHeight()
    }

    window.addEventListener('resize', onResize)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onResize)
      vv.addEventListener('scroll', onResize)
    }

    // 3. Fallback window event listeners
    const onNativeShow = () => setKeyboardState(true)
    const onNativeHide = () => setKeyboardState(false)

    window.addEventListener('keyboardDidShow', onNativeShow)
    window.addEventListener('keyboardWillShow', onNativeShow)
    window.addEventListener('keyboardDidHide', onNativeHide)
    window.addEventListener('keyboardWillHide', onNativeHide)

    // 4. MutationObserver on document.body for component sync
    const onMutation = () => {
      const hasAttr =
        document.body.getAttribute('data-native-keyboard-open') === 'true' ||
        document.body.getAttribute('data-terminal-keyboard-open') === 'true'
      setIsKeyboardOpen(hasAttr)
    }
    const observer = new MutationObserver(onMutation)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-native-keyboard-open', 'data-terminal-keyboard-open'],
    })

    // Initial check
    evaluateFromHeight()

    return () => {
      window.removeEventListener('resize', onResize)
      if (vv) {
        vv.removeEventListener('resize', onResize)
        vv.removeEventListener('scroll', onResize)
      }
      window.removeEventListener('keyboardDidShow', onNativeShow)
      window.removeEventListener('keyboardWillShow', onNativeShow)
      window.removeEventListener('keyboardDidHide', onNativeHide)
      window.removeEventListener('keyboardWillHide', onNativeHide)
      if (showSub?.remove) showSub.remove()
      if (hideSub?.remove) hideSub.remove()
      if (hasCapacitorKeyboard) {
        Keyboard.removeAllListeners().catch(() => {})
      }
      observer.disconnect()
    }
  }, [isAndroidApp, isTerminalPage])

  return { isKeyboardOpen, isAndroidApp }
}
