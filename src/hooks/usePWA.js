import { useState, useEffect, useCallback } from 'react'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable,  setIsInstallable]  = useState(() => {
    if (typeof window === 'undefined') return false
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    return isIOS && isSafari
  })
  const [isInstalled,    setIsInstalled]    = useState(() => {
    return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    if (isInstalled) return

    const onBeforeInstall = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [isInstalled])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setIsInstallable(false)
    if (outcome === 'accepted') { setIsInstalled(true); return true }
    return false
  }, [deferredPrompt])

  return { isInstallable, isInstalled, install }
}
