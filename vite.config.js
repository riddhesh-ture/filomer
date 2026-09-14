import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// COOP + COEP are required for SharedArrayBuffer, which @ffmpeg/ffmpeg v0.12
// uses internally. They must be present in BOTH dev and preview/production.
// For production static hosts add public/_headers (Netlify/Cloudflare Pages)
// or configure your server/CDN to send these on every response.
const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server:  { headers: securityHeaders },
  preview: { headers: securityHeaders },
})
