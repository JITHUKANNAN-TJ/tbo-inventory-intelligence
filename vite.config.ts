import { defineConfig, type Plugin, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relaxed policy used only while serving the dev server (hot reload needs inline
// module preambles and the HMR websocket). Production keeps the strict meta policy.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws://localhost:5173 http://localhost:5173; media-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"

function devCspPlugin(): Plugin {
  let command: 'build' | 'serve' = 'build'
  return {
    name: 'tbo-dev-csp',
    configResolved(config) {
      command = config.command
    },
    transformIndexHtml(html) {
      if (command !== 'serve') return html
      return html.replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i, (_match, pre, _csp, post) => `${pre}${DEV_CSP}${post}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), devCspPlugin()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
})