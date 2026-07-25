import { useState, useEffect, useCallback } from 'react'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable,  setIsInstallable]  = useState(false)
  const [isInstalled,    setIsInstalled]    = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isIOS && isSafari) setIsInstallable(true)

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
  }, [])

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
