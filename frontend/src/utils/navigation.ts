type NavigateFunction = (to: string) => void

let globalNavigator: NavigateFunction | null = null

export function registerNavigator(navigator: NavigateFunction) {
  globalNavigator = navigator
}

export function navigateTo(path: string) {
  if (globalNavigator) {
    try {
      globalNavigator(path)
      return
    } catch (err) {
      console.warn("Navigation failed, falling back to window.location:", err)
    }
  }
  if (typeof window !== "undefined") {
    window.location.href = path
  }
}
