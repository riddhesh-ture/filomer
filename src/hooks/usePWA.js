import { useState, useEffect, useCallback } from 'react'

const KEYS = {
  LAUNCHED:        'devsuite_launched',
  ENGINE_INSTALLED:'devsuite_engine_ready',
}

const FFMPEG_CACHE_NAME = 'ffmpeg-wasm-cache'
const FFMPEG_CORE_URL   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js'
const FFMPEG_WASM_URL   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'

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

export async function checkEngineCache() {
  if (localStorage.getItem(KEYS.ENGINE_INSTALLED) === 'true') return true
  try {
    if (!('caches' in window)) return false
    const cache = await caches.open(FFMPEG_CACHE_NAME)
    const [coreRes, wasmRes] = await Promise.all([
      cache.match(FFMPEG_CORE_URL),
      cache.match(FFMPEG_WASM_URL),
    ])
    const cached = !!(coreRes && wasmRes)
    if (cached) localStorage.setItem(KEYS.ENGINE_INSTALLED, 'true')
    return cached
  } catch { return false }
}

export function markEngineInstalled() {
  localStorage.setItem(KEYS.ENGINE_INSTALLED, 'true')
}

export function markEngineUninstalled() {
  localStorage.removeItem(KEYS.ENGINE_INSTALLED)
}

export function useFirstRun() {
  const [isFirstRun,   setIsFirstRun]   = useState(null)
  const [engineCached, setEngineCached]  = useState(false)

  useEffect(() => {
    const launched = localStorage.getItem(KEYS.LAUNCHED)
    setIsFirstRun(!launched)
    checkEngineCache().then(setEngineCached)
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(KEYS.LAUNCHED, 'true')
    setIsFirstRun(false)
  }, [])

  return { isFirstRun, engineCached, dismiss }
}
