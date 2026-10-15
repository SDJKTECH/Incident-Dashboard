/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const DB_FILE = resolve(__dirname, 'data', 'incident-dashboard.db')
const MAX_DB_BYTES = 50 * 1024 * 1024

// Dev only: the app PUTs its exported SQLite bytes here so a real .db file exists in the project.
function dbFilePlugin(): Plugin {
  return {
    name: 'incident-db-file',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__db', (req, res) => {
        if (req.method !== 'PUT') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size <= MAX_DB_BYTES) chunks.push(chunk)
        })
        req.on('end', () => {
          if (size === 0 || size > MAX_DB_BYTES) {
            res.statusCode = 400
            res.end()
            return
          }
          try {
            mkdirSync(resolve(__dirname, 'data'), { recursive: true })
            const tmp = `${DB_FILE}.tmp`
            writeFileSync(tmp, Buffer.concat(chunks))
            renameSync(tmp, DB_FILE)
            res.statusCode = 204
          } catch {
            res.statusCode = 500
          }
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dbFilePlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
