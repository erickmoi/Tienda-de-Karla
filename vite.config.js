import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Huella de esta versión: el commit en Netlify, o la hora al compilar en local.
// La app compara su huella con /version.json para saber si hay una versión nueva.
const VERSION = (process.env.COMMIT_REF || Date.now().toString(36)).slice(0, 12)

const archivoVersion = {
  name: 'archivo-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) })
  },
}

export default defineConfig({
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [react(), tailwindcss(), archivoVersion],
})
