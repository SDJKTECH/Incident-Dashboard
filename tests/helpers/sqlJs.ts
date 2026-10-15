/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Database, SqlJsStatic } from 'sql.js'

const require = createRequire(import.meta.url)

/** Loads real sql.js with the WASM binary read from disk (works under jsdom). */
export async function loadRealSql(): Promise<SqlJsStatic> {
  const init = (await import('sql.js')).default
  const wasmBinary = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
  return init({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer })
}

export async function newDb(blob?: Uint8Array): Promise<Database> {
  const SQL = await loadRealSql()
  return blob ? new SQL.Database(blob) : new SQL.Database()
}
